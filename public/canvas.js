import { LOTR_STARTER_DECK_ARAGORN } from "./decks.js";
import { initializePlayerDeck } from "./decks.js";

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const aspectRatio = 7680 / 4320;
const BASE_HEIGHT = 4320;
const BASE_WIDTH = 7680;
canvas.width = window.innerWidth;
canvas.height = window.innerWidth / aspectRatio;

// Assets
let backgroundImage = new Image();
backgroundImage.src = 'assets/background.jpeg'
const cardLibrary = {
    "lotrbackground": new Image()
}
cardLibrary["lotrbackground"].src = 'assets/Lotrbackground.png'

function getCardImage(cardId) {
    // Return cached card id.
    if (cardLibrary[cardId]) {
        return cardLibrary[cardId];
    }

    const img = new Image();
    img.src = `assets/cards/${cardId}.png`;
    console.log("Loading : %s", img.src)
    cardLibrary[cardId] = img;
    return img;
}

// Track mouse position
let mouseX = 0;
let mouseY = 0;

// base scale coordinates in percentages?
const CARD_HEIGHT = 994 / 5;
const CARD_WIDTH = 714 / 5;

const SITE_CARD_HEIGHT = 714 / 6;
const SITE_CARD_WIDTH = 994 / 6;
const MAX_CARDS_IN_HAND = 12;
const PLAYER_HAND_OFFSET = 50;
const CARD_PREVIEW_SHIFT = 20;
const CARD_PREVIEW_SCALE_FACTOR = 3.0;
const OPPONENT_HAND_OFFSET = 40

// Define the "snap area" (a target area where cards should snap when dropped)
const playerHand = {
    x: SITE_CARD_WIDTH + 50, y: canvas.height - CARD_HEIGHT - 30,
    width: CARD_WIDTH * 5, height: CARD_HEIGHT
}

// Define the "snap area" (a target area where cards should snap when dropped)
const drawDeck = {
    x: playerHand.x + playerHand.width + 20, y: canvas.height - CARD_HEIGHT - 30,
    width: CARD_WIDTH, height: CARD_HEIGHT
}

const discardPile = {
    x: drawDeck.x + drawDeck.width + 20, y: canvas.height - CARD_HEIGHT - 30,
    width: CARD_WIDTH, height: CARD_HEIGHT
}

const deadPile = {
    x: discardPile.x + discardPile.width + 20, y: canvas.height - CARD_HEIGHT - 30,
    width: CARD_HEIGHT, height: CARD_WIDTH
}

const supportZone = {
    x: playerHand.x, y: playerHand.y - (CARD_HEIGHT+5),
    width: playerHand.width, height: playerHand.height
}

const companionZone = {
    x: supportZone.x, y: supportZone.y - (CARD_HEIGHT+ 5),
    width: supportZone.width, height: supportZone.height
}
// Opponent card hand areas
const opponentDeadPile = {
    x: SITE_CARD_WIDTH + 50, y: 30,
    width: CARD_HEIGHT, height: CARD_WIDTH
}
const opponentDiscardPile = {
    x: opponentDeadPile.x + opponentDeadPile.width + 20, y: OPPONENT_HAND_OFFSET,
    width: CARD_WIDTH, height: CARD_HEIGHT
}

const opponentDeck = {
    x: opponentDiscardPile.x + opponentDiscardPile.width + 20, y: OPPONENT_HAND_OFFSET,
    width: CARD_WIDTH, height: CARD_HEIGHT
}

const opponentHand = {
    x: opponentDeck.x + opponentDeck.width + 20, y: OPPONENT_HAND_OFFSET,
    width: CARD_WIDTH * 4, height: CARD_HEIGHT
}

const siteSlots = [];
for (let i = 0; i < 9; i++) {
    siteSlots.push({
        x: 40,
        y: canvas.height * 0.025 + ((SITE_CARD_HEIGHT + 5) * i),
        width: SITE_CARD_WIDTH, height: SITE_CARD_HEIGHT
    });
}


// Card object structure, top of cards is "top of stack"

const gameState = {
    playerName: "",
    gameId: "",

    dragActive: false,
    cardsInPlay: [],
    cardsInPlayerHand: [],
    cardsInPlayerDiscard: [],
    cardsInSiteSlots: [],
    cardsInPlayerDeadPile: [],
    cardsInDrawDeck: [],

    cardsInOpponentPlay: [],
    cardsInOpponentsHand: [],
    cardsInOpponentsDiscard: [],
    cardsInOpponentDeadPile: [],
    cardsInOpponentDrawDeck: [],
    cardsInOpponentSite: [],
}

let uuid_ref = 0;
function initCard(_id) {
    uuid_ref++;
    return {
        id: _id, // This is the reefrence picture
        ref: uuid_ref, // unique identifier for this players instance of _id
        x: drawDeck.x,
        y: drawDeck.y,
        z: 0,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        isDragged: false,
        isHover: false
    }
}

function sendGameEvent(event) {
    console.log("Dispatching gameEvent: %s", JSON.stringify(event, null, 2))
    document.dispatchEvent(new CustomEvent("gameEvent", { detail: event }));
}

function sendDeckInitialized(deckSize) {
    let deckLoadedEvent = {
        type : "deckInitialized",
        deckSize : deckSize,
    }
    sendGameEvent(deckLoadedEvent)
}

async function initCardDeck() {
    // Load from starter deck.
    // E.g. csv.lines.forEach({cardsInDrawDeck.push(initCard(line))})
    gameState.playerName = sessionStorage.getItem("playerName")
    gameState.gameId = sessionStorage.getItem("gameId")
    gameState.deck = sessionStorage.getItem("deckName")

    let initialDeck = await initializePlayerDeck(gameState.deck)
    initialDeck.forEach(cardObj => {
        // console.log(JSON.stringify(cardObj, null, 2));
        gameState.cardsInDrawDeck.push(initCard(cardObj.cardId));
    })

    sendDeckInitialized(initialDeck.length)
}

await initCardDeck();


// ============================================================
// Card Management, needs events to be sent back to server.
// ============================================================

/*
ID: PlayerLogin Id.
GameId: PlayerGame Id
EVENT: One of "Card Drawn", "Card Discarded", "Card Played on Table", "Card added to dead Pile"/ etc.

{
"player" : <ID>,
"gameId": <GAMEID>,
"event" : <EVENT>,
"detals" : {
    "cardId" : <CARDID>,
}
}
*/

function sendCardMovedEvent(_from, _to, card, _site = 0) {
    let event = {
        type: "moveCard",
        cardId: card.id,
        cardRef: card.ref,
        fromPile: _from,
        toPile: _to,
        position: { x: Math.round(card.x), y: Math.round(card.y) }, // only relevant for in play cards.
        playerId: gameState.playerName
    }
    console.log("Dispatching cardMovedEvent: %s", JSON.stringify(event, null, 2))
    document.dispatchEvent(new CustomEvent("cardEvent", { detail: event }));
}

function placeCardInHand(from, card) {
    console.log("Placing %s into hand", card.id)

    // Snap to end of hand location
    let numCardsInHand = gameState.cardsInPlayerHand.length;

    // card.x = playerHand.x + numCardsInHand * PLAYER_HAND_OFFSET;
    // card.y = playerHand.y;

    gameState.cardsInPlayerHand.push(card)

    // Reshuffle/organize playerhand
    for (let i = numCardsInHand; i >= 0; i--) {
        let card = gameState.cardsInPlayerHand[i];
        card.x = playerHand.x + i * PLAYER_HAND_OFFSET;
        card.y = playerHand.y;
    }

    sendCardMovedEvent(from, "playerHand", card)
}

function placeCardOnPlayArea(from, card) {
    console.log("Removing card %s from hand", card.id)
    gameState.cardsInPlay.push(card)

    sendCardMovedEvent(from, "playArea", card)
}

function placeCardInDiscard(from, card) {
    console.log("Discarding card id:%s", card.id)

    gameState.cardsInPlayerDiscard.push(card)

    card.x = discardPile.x;
    card.y = discardPile.y;

    sendCardMovedEvent(from, "playerDiscard", card)
}

function placeCardInDeadPile(from, card) {
    console.log("Adding card to dead pile")

    gameState.cardsInPlayerDeadPile.push(card)

    card.x = deadPile.x
    card.y = deadPile.y

    sendCardMovedEvent(from, "playerDeadPile", card)
}

function placeCardAtSite(from, card, siteNum) {
    console.log("Adding card to site :%d", siteNum)

    if (siteNum < siteSlots.length) {
        if (gameState.cardsInSiteSlots[siteNum] || gameState.cardsInOpponentSite[siteNum]) {
            console.log("Card already exists at site: %d", siteNum + 1)
        } else {
            gameState.cardsInSiteSlots[siteNum] = card;
            card.x = siteSlots[siteNum].x
            card.y = siteSlots[siteNum].y

            sendCardMovedEvent(from, "site" + (siteNum + 1), card)
            return true
        }
    }
    return false
}

// ============================================================
// Audio/sounds
// ============================================================
const audioLibrary = []
function playSound(soundEffect) {

    if (!audioLibrary[soundEffect]) {
        audioLibrary[soundEffect] = new Audio('assets/sound/' + soundEffect + ".mp3")
    }
    audioLibrary[soundEffect].play()

}
// ============================================================
// Game board drawing code (probably needs to be react.js 'ified.)
// ============================================================
function getScale() {
    return { x: 1.0, y: 1.0 };
    return {
        x: canvas.width / BASE_WIDTH,
        y: canvas.height / BASE_HEIGHT,
    }

}

// Generic drawing of black text
function drawText(text, x, y, centered = true) {
    ctx.font = '10px "Uncial Antiqua", cursive'; // Set font size and type
    ctx.fillStyle = 'black'; // Set text color
    if (centered) {
        const textWidth = ctx.measureText(text).width;
        x = x - textWidth / 2;
    }
    ctx.fillText(text, x, y); // Draw the text at position (50, 150)
}

// Card text is against black background, so draw white (if applicable)
function drawCardText(text, x, y) {
    ctx.font = '10px "Uncial Antiqua", cursive'; // Set font size and type
    ctx.fillStyle = 'black'; // Set text color
    ctx.fillText(text, x, y); // Draw the text at position (50, 150)
}

function drawRect(area, text = "") {
    const scale = getScale();
    let x = area.x * scale.x;
    let y = area.y * scale.y;
    //let width = area.width * scale.width;
    //let height = area.height * scale.height;
    let width = area.width;
    let height = area.height;
    console.log("Drawing zone(%s) @ (%d, %d+%d+%d)", text,         x,y ,width ,height);
   
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5';
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(x, y, width, height);

    drawText(text, x + width / 2, y + height / 2)
}

// Draw the actual card based on its position/motion/animation info.
function drawCard(card, shadowColor = 'white') {
    // Draw semi transparent card
    ctx.fillStyle = card.isDragged ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 1.0)';
    ctx.fillRect(card.x, card.y, card.width, card.height);
    ctx.strokeRect(card.x, card.y, card.width, card.height);

    // Draw the PNG image inside the card
    const cardImage = getCardImage(card.id)
    if (cardImage) {
        if (cardImage.complete) {   // Make sure the image is loaded
            ctx.save()
            if (card.isDragged) {
                ctx.shadowColor = shadowColor;
                ctx.shadowBlur = 20;
            }
            ctx.drawImage(cardImage, card.x, card.y, card.width, card.height);
            ctx.restore();
        }
    }
    let cardText = "Card id:" + card.id + "card ref:" + card.ref
    drawCardText(cardText, card.x + CARD_WIDTH, card.y + card.height / 2 + 16)
}

function drawCardRotated(card, angle, shadowColor=null) {
    const cardImage = getCardImage(card.id)
    if (cardImage) {
        if (cardImage.complete) {

            ctx.save();
            ctx.fillStyle = card.isDragged ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 1.0)';
            ctx.translate(card.x, card.y); // set rotation point.
            ctx.rotate(angle * (Math.PI / 180)); // Convert degrees to radians

            ctx.fillRect(card.x, card.y, card.width, card.height);
            ctx.strokeRect(card.x, card.y, card.width, card.height);
            if (shadowColor) {
                ctx.shadowColor = shadowColor;
                ctx.shadowBlur = 20;
            }
            ctx.drawImage(cardImage, 0, -card.height, card.width, card.height);
            ctx.restore();
        }
    }
}

function drawCardReverse(card) {
    ctx.fillStyle = card.isDragged ? 'rgba(255, 255, 255, 0.5)' : 'rgba(255, 255, 255, 1.0)';
    ctx.fillRect(card.x, card.y, card.width, card.height);
    ctx.strokeRect(card.x, card.y, card.width, card.height);

    // Draw the PNG image inside the card
    const cardImage = cardLibrary["lotrbackground"]
    if (cardImage.complete) {   // Make sure the image is loaded
        ctx.drawImage(cardImage, card.x + 1, card.y, card.width, card.height);
    }
}

// Draw an expanded card for easier view, only on hover in player hand.
function drawCardPreview(card, drawUnder = false) {
    let cardPreview = { ...card };
    cardPreview.width *= CARD_PREVIEW_SCALE_FACTOR;
    cardPreview.height *= CARD_PREVIEW_SCALE_FACTOR;
    if (drawUnder) {
        cardPreview.y = card.y + card.height + 5
    } else {
        cardPreview.y = cardPreview.y - cardPreview.height - 5;
    }
    drawCard(cardPreview)

    drawText(JSON.stringify(card, null, 2), cardPreview.x + cardPreview.width / 2, cardPreview.y + cardPreview.height / 2)
}

// Draw all "loose leaf" cards on the table.
function drawInPlayCards() {
    // Draw the cards
    gameState.cardsInPlay.forEach(card => {
        if (card.isHover) {
            drawCard(card)
            drawCardPreview(card)
        } else {
            drawCard(card);
        }
    });
}

function drawOpponentCardsInPlay() {
    gameState.cardsInOpponentPlay.forEach(card => {
        if (card.isHover) {
            let tmp = card.isDragged;
            card.isDragged = true;
            drawCard(card, 'red')
            card.isDragged = tmp
            drawCardPreview(card)
        } else {
            card.isDragged = true
            drawCard(card, 'red');
            card.isDragged = false
        }
    })
}

function drawOpponentDiscardPile() {
    let numCardsInDiscard = gameState.cardsInOpponentsDiscard.length
    if (numCardsInDiscard > 0) {
        // draw rotated.
        let card = gameState.cardsInOpponentsDiscard[numCardsInDiscard - 1]
        card.x = opponentDiscardPile.x;
        card.y = opponentDiscardPile.y;
        if (card.isHover) {
            let offsetCard = { ...card }
            offsetCard.y = card.y + CARD_PREVIEW_SHIFT;
            drawCard(offsetCard)
            drawCardPreview(offsetCard, true)
        } else {
            drawCard(card);
        }
    }
}

function drawOpponentDeck() {
    let numCardsInDrawDeck = gameState.cardsInOpponentDrawDeck.length
    if (numCardsInDrawDeck > 0) {
        for (let i = 0; i < numCardsInDrawDeck; i++) {
            // draw a square decreasing draw deck.
            gameState.cardsInOpponentDrawDeck[i].y = opponentDeck.y;
            gameState.cardsInOpponentDrawDeck[i].x = opponentDeck.x + Math.floor(Math.sqrt(i)) * 2;
            drawCardReverse(gameState.cardsInOpponentDrawDeck[i])
        }
    }
}

function drawOpponentHand() {
    let i = 0;
    gameState.cardsInOpponentsHand.forEach(card => {
        card.x = opponentHand.x + PLAYER_HAND_OFFSET * i;
        card.y = opponentHand.y;
        i++;
        drawCardReverse(card);
    })
}

function drawPlayerHandGradient() {
    const grad = ctx.createLinearGradient(0, 0, playerHand.width, 0);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.5)');

    ctx.fillStyle = grad;
    ctx.fillRect(playerHand.x, playerHand.y, playerHand.width, playerHand.height);

    ctx.strokeStyle = '#000';
    ctx.strokeRect(playerHand.x, playerHand.y, playerHand.width, playerHand.height);
}

// Draw all the cards in a players hand, and if they are hovering over a card, an enlarged one.
function drawPlayerHand() {
    // Draw cards statically in hand
    gameState.cardsInPlayerHand.forEach(card => {
        // If mouse is hovering over a card in the player hand enlarge it.
        if (card.isHover) {
            let offsetCard = { ...card }
            offsetCard.y = card.y - CARD_PREVIEW_SHIFT;
            drawCard(offsetCard)
            drawCardPreview(offsetCard)
        } else {
            drawCard(card);
        }
    });

    drawText("Number of Cards in Hand : " + gameState.cardsInPlayerHand.length, playerHand.x, playerHand.y + CARD_HEIGHT)
}



function drawDiscardPile() {
    let numCardsInDiscard = gameState.cardsInPlayerDiscard.length
    if (numCardsInDiscard > 0) {
        // draw rotated.
        let card = gameState.cardsInPlayerDiscard[numCardsInDiscard - 1]
        if (card.isHover) {
            let offsetCard = { ...card }
            offsetCard.y = card.y - CARD_PREVIEW_SHIFT;
            drawCard(offsetCard)
            drawCardPreview(offsetCard)
        } else {
            drawCard(card);
        }
    }
}


function drawDiscardPileBorder() {
    drawRect(discardPile, "DISCARD");
}
// Yes... draw the "Draw" deck.. TODO, rename draw->  render?
function drawDrawDeckBorder() {
    drawRect(drawDeck, "DRAW EMPTY");
}
function drawDeadPileBorder() {
    drawRect(deadPile, "DEADPILE")
}
function drawDrawDeck() {
    let numCardsInDrawDeck = gameState.cardsInDrawDeck.length
    if (numCardsInDrawDeck > 0) {
        for (let i = 0; i < numCardsInDrawDeck; i++) {
            gameState.cardsInDrawDeck[i].x = drawDeck.x + Math.floor(Math.sqrt(i)) * 2;
            drawCardReverse(gameState.cardsInDrawDeck[i])
        }
    }
}

function drawBackground() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
    if (backgroundImage.complete) {
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    }
}



function drawSiteBorders() {
    let i = 0;
    siteSlots.forEach(siteSlot => {
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5';
        ctx.fillRect(siteSlot.x, siteSlot.y, siteSlot.width, siteSlot.height);
        ctx.strokeStyle = '#000';
        ctx.strokeRect(siteSlot.x, siteSlot.y, siteSlot.width, siteSlot.height);
        i++;
        let siteName = "Site " + i;
        drawText(siteName, siteSlot.x + siteSlot.width / 2, siteSlot.y + siteSlot.height / 2);
    })
}



function drawDeadPile() {
    let numCardsInDeadPile = gameState.cardsInPlayerDeadPile.length
    if (numCardsInDeadPile > 0) {
        drawCardRotated(gameState.cardsInPlayerDeadPile[numCardsInDeadPile - 1], 90)
    }
}

function drawSiteCard(card, shadowColor) {
    let siteCard = { ...card }
    siteCard.width = SITE_CARD_HEIGHT;
    siteCard.height = SITE_CARD_WIDTH;
    drawCardRotated(siteCard, 90, shadowColor)
    if (siteCard.isHover) {
        drawCardPreview(siteCard); // needs to be rotated
    }
}

function drawSiteCards() {
    for (let i = 0; i < gameState.cardsInSiteSlots.length; i++) {
        if (gameState.cardsInSiteSlots[i]) {
            drawSiteCard(gameState.cardsInSiteSlots[i], 'white')
        }
    }
}

function drawOpponentSiteCards() {
    for (let i = 0; i< gameState.cardsInOpponentSite.length; i++) {
        if (gameState.cardsInOpponentSite[i]) {
            drawSiteCard(gameState.cardsInOpponentSite[i], 'red')
        }
    }
}

function drawOpponentArea() {
    drawRect(opponentDeadPile, "Dead Pile")
    drawRect(opponentDiscardPile, "Discard Pile")
    drawRect(opponentHand, "Hand")
    drawRect(opponentDeck, "Deck")
}

function drawCompanionZone() {
    // TODO Flexible drawing.
    drawRect(companionZone, "Place Companions Here");
}

function drawSupportZone() {
     drawRect(supportZone, "Place support cards here")
}

function drawStaticSnapZones() {
    drawCompanionZone();
    drawPlayerHandGradient();
    drawDiscardPileBorder();
    drawDrawDeckBorder();
    drawSiteBorders();
    drawDeadPileBorder();
    drawOpponentArea();

    //drawCompanionZone();
    drawSupportZone();
}

function drawCards() {
    // Opponent cards are "somewhat static"
    drawOpponentSiteCards()
    // Draw floating cards.
    drawInPlayCards()
    // Draw cards in the hand.
    drawPlayerHand()
    // Draw top of discard
    drawDiscardPile()
    // Draw deck
    drawDrawDeck()
    // Dead Pile
    drawDeadPile()
    // sites.
    drawSiteCards()
}

function drawOpponentCards() {
    drawOpponentCardsInPlay();
    drawOpponentDiscardPile();
    drawOpponentDeck();
    drawOpponentHand();
}
function draw() {
    // Draw background image (TODO change each game or add option to change.)
    drawBackground();
    // Draw static images.
    //    drawPlayerHandBorder()


    drawStaticSnapZones();
    drawCards();
    drawOpponentCards();
}

// ============================================================
// Interaction management / gen UI.
// ============================================================
// Check if the mouse is over a card
function isMouseOverCard(card) {
    return mouseX >= card.x && mouseX <= card.x + card.width &&
        mouseY >= card.y && mouseY <= card.y + card.height;
}

function isMouseOverCardRotated(card) {
    return mouseX >= card.x && mouseX <= card.x + card.height &&
        mouseY >= card.y && mouseY <= card.y + card.width;
}

function mouseInSnapArea(snapArea) {
    return mouseX >= snapArea.x && mouseX <= snapArea.x + snapArea.width &&
        mouseY >= snapArea.y && mouseY <= snapArea.y + snapArea.height;
}

// Handle mouse down event to start dragging a card
canvas.addEventListener('mousedown', (e) => {
    mouseX = e.offsetX;
    mouseY = e.offsetY;

    // Handle player zones before "free leaf cards"
    for (let i = gameState.cardsInPlayerHand.length - 1; i >= 0; i--) {
        let card = gameState.cardsInPlayerHand[i]
        if (isMouseOverCard(card)) {
            card.isDragged = true;
            gameState.dragActive = true;
            console.log("mousedown event for %d", card.id)
            return;
        }
    };

    if (gameState.cardsInPlayerDiscard.length > 0) {
        let card = gameState.cardsInPlayerDiscard[gameState.cardsInPlayerDiscard.length - 1];
        console.log("Discard pile check, checking: %s", card.id)
        if (isMouseOverCard(card)) {
            card.isDragged = true;
            gameState.dragActive = true;
            console.log("mousedown event for %s", card.id)
            return;
        }
    };

    gameState.cardsInSiteSlots.forEach(card => {
        // Check to make a card exists at that slot.
        if (card && isMouseOverCardRotated(card)) {
            card.isDragged = true;
            gameState.dragActive = true;
            console.log("mousedown event for :%s", card.id);
            return;
        }
    })

    if (gameState.cardsInPlayerDeadPile.length > 0) {
        let card = gameState.cardsInPlayerDeadPile[gameState.cardsInPlayerDeadPile.length - 1];
        if (isMouseOverCardRotated(card)) {
            card.isDragged = true;
            gameState.dragActive = true;
            console.log("mousedown event for %s", card.id)
            return;
        }
    };

    for (let i = gameState.cardsInPlay.length - 1; i >= 0; i--) {
        let card = gameState.cardsInPlay[i]
        if (isMouseOverCard(card)) {
            card.isDragged = true;
            gameState.dragActive = true;
            console.log("mousedown event for card %d (id:%d)", i, card.id)
            return;
        }
    }


});

// Handle mouse move event to drag the card
canvas.addEventListener('mousemove', (e) => {
    mouseX = e.offsetX;
    mouseY = e.offsetY;

    // Draw drag movement.
    if (gameState.dragActive) {
        gameState.cardsInPlay.forEach(card => {
            if (card.isDragged) {
                card.x = mouseX - card.width / 2;
                card.y = mouseY - card.height / 2;
            }
        });

        gameState.cardsInPlayerHand.forEach(card => {
            if (card.isDragged) {
                card.x = mouseX - card.width / 2;
                card.y = mouseY - card.height / 2;
            }
        });

        if (gameState.cardsInPlayerDeadPile.length > 0) {
            let card = gameState.cardsInPlayerDeadPile[gameState.cardsInPlayerDeadPile.length - 1]
            if (card.isDragged) {
                card.x = mouseX - card.width / 2;
                card.y = mouseY - card.height / 2;
            }
        }

        if (gameState.cardsInPlayerDiscard.length > 0) {
            let card = gameState.cardsInPlayerDiscard[gameState.cardsInPlayerDiscard.length - 1]
            if (card.isDragged) {
                card.x = mouseX - card.width / 2;
                card.y = mouseY - card.height / 2;
            }
        }
        gameState.cardsInSiteSlots.forEach(card => {
            if (card && card.isDragged) {
                card.x = mouseX - card.width / 2;
                card.y = mouseY - card.height / 2
            }
        })
    }

    // Check for hover mechanics
    gameState.cardsInPlayerHand.forEach(card => {
        if (card) { card.isHover = false; }
    });
    gameState.cardsInPlayerDiscard.forEach(card => {
        card.isHover = false;
    });
    gameState.cardsInPlay.forEach(card => {
        card.isHover = false;
    });
    gameState.cardsInSiteSlots.forEach(card => {
        if (card) { card.isHover = false; }
    });
    gameState.cardsInOpponentPlay.forEach(card => {
        card.isHover = false;
    })

    // Check for hover mechanics.
    if (gameState.dragActive == false) {
        for (let i = gameState.cardsInPlayerHand.length - 1; i >= 0; i--) {
            let card = gameState.cardsInPlayerHand[i];
            if (isMouseOverCard(card)) {
                card.isHover = true;
                break;
            }
        };

        let numCardsInDiscard = gameState.cardsInPlayerDiscard.length
        if (numCardsInDiscard > 0) {
            let card = gameState.cardsInPlayerDiscard[numCardsInDiscard - 1];
            if (isMouseOverCard(card)) {
                card.isHover = true;
            }
        }

        for (let i = gameState.cardsInPlay.length - 1; i >= 0; i--) {
            let card = gameState.cardsInPlay[i];
            if (card && isMouseOverCard(card)) {
                card.isHover = true;
                break;
            }
        }

        for (let i = gameState.cardsInSiteSlots.length - 1; i >= 0; i--) {
            let card = gameState.cardsInSiteSlots[i];
            if (card && isMouseOverCardRotated(card)) {
                card.isHover = true;
                break;
            }
        }

        // Hover inspection for opponent cards.
        for (let i = gameState.cardsInOpponentPlay.length - 1; i >= 0; i--) {
            let card = gameState.cardsInOpponentPlay[i];
            if (card && isMouseOverCard(card)) {
                card.isHover = true;
                break;
            }
        }
    }
    draw();
});



// ================================================
// IPC handling and sending
// ================================================
function handleSitePlacement(from, card) {
    for (let i = 0; i < siteSlots.length; i++) {
        let site = siteSlots[i]
        if (mouseInSnapArea(site)) {
            return placeCardAtSite(from, card, i);
        }
    }
    console.log("Did not find site, returning")
    return false
}

function handleGenericCardMoved(from, selectedCard) {
    // Generic handler for moving/playing cards.
    if (mouseInSnapArea(playerHand)) {
        placeCardInHand(from, selectedCard)
    } else if (mouseInSnapArea(discardPile)) {
        placeCardInDiscard(from, selectedCard)
    } else if (mouseInSnapArea(deadPile)) {
        placeCardInDeadPile(from, selectedCard)
    } else if (handleSitePlacement(from, selectedCard)) {
        console.log("Site place handled")
    } else {
        placeCardOnPlayArea(from, selectedCard);
    }
    selectedCard.isDragged = false;
    gameState.dragActive = false;
}

function handleFreeCardMoved() {
    // Check to see if the card moved from the board "canvas" into hand.
    for (let i = gameState.cardsInPlay.length - 1; i >= 0; i--) {
        let card = gameState.cardsInPlay[i];
        if (card.isDragged) {
            const selectedCard = gameState.cardsInPlay.splice(i, 1)[0]; // Remove card from array
            // Snap to the target area if it's close enough
            handleGenericCardMoved("playArea", selectedCard)
            break
        }
    }
}

function handlePlayerCardMoved() {
    // Check to see if card moved from hand onto board.
    for (let i = gameState.cardsInPlayerHand.length - 1; i >= 0; i--) {
        let card = gameState.cardsInPlayerHand[i];
        if (card.isDragged) {
            const selectedCard = gameState.cardsInPlayerHand.splice(i, 1)[0];
            handleGenericCardMoved("playerHand", selectedCard)
            break;
        }
    }
}

// Cards from deck immediately go into player Hand.
function handleDrawDeckRelease() {
    if (gameState.cardsInDrawDeck.length > 0) {
        console.log("Checking mouse up on draw deck")
        if (isMouseOverCard(gameState.cardsInDrawDeck[gameState.cardsInDrawDeck.length - 1])) {
            if (gameState.cardsInPlayerHand.length < MAX_CARDS_IN_HAND) {
                let randomIndex = Math.floor(Math.random() * gameState.cardsInDrawDeck.length);
                const pulledCard = gameState.cardsInDrawDeck.splice(randomIndex, 1)[0];
                placeCardInHand("playerDeck", pulledCard);
            } else {
                console.log("Too many cards in hand.")
                alert("Max number of cards added")
            }
        }
    }
}

function handleDiscardRelease() {
    if (gameState.cardsInPlayerDiscard.length > 0) {
        let card = gameState.cardsInPlayerDiscard[gameState.cardsInPlayerDiscard.length - 1]
        if (card.isDragged) {
            const selectedCard = gameState.cardsInPlayerDiscard.pop();
            handleGenericCardMoved("playerDiscard", selectedCard);
        }
    }
}

function handleDeadPileRelease() {
    if (gameState.cardsInPlayerDeadPile.length > 0) {
        let card = gameState.cardsInPlayerDeadPile[gameState.cardsInPlayerDeadPile.length - 1]
        if (card.isDragged) {
            const selectedCard = gameState.cardsInPlayerDeadPile.pop();
            handleGenericCardMoved("playerDeadPile", selectedCard)
        }
    }
}

function handleSiteSlotsRelease() {

    for (let i = 0; i < gameState.cardsInSiteSlots.length; i++) {
        let card = gameState.cardsInSiteSlots[i];
        if (card && card.isDragged) {
            handleGenericCardMoved("site" + (i + 1), card);
            delete gameState.cardsInSiteSlots[i];
            break;
        }
    }
}
// Handle mouse up event to stop dragging and snap the card
canvas.addEventListener('mouseup', () => {
    // Modifying cards while looping through it?? ehh..
    handleFreeCardMoved()
    handlePlayerCardMoved()
    handleDiscardRelease()
    handleSiteSlotsRelease()
    handleDeadPileRelease()
    handleDrawDeckRelease()

    draw();
});

function moveStackToDrawDeck(stack) {
    while (stack.length > 0) {
        let card = stack.pop();
        card.x = drawDeck.x;
        card.y = drawDeck.y;
        gameState.cardsInDrawDeck.push(card);
    }
}
function handleGatherAndShuffleCards() {
    moveStackToDrawDeck(gameState.cardsInPlay)
    moveStackToDrawDeck(gameState.cardsInPlayerHand)
    moveStackToDrawDeck(gameState.cardsInPlayerDiscard)
    moveStackToDrawDeck(gameState.cardsInPlayerDeadPile)
}


//
// Handle opponent card moves
//
function findCardFromOtherSite(eventData) {
    for (let i =0 ; i < gameState.cardsInOpponentSite.length; i++) {
         let existingCard = gameState.cardsInOpponentSite[i];
         if (existingCard && existingCard.ref === eventData.cardRef) {
             console.log("Found card at existing site");
             delete gameState.cardsInOpponentSite[i];
             return existingCard;
         }
     };
}

function findCardFromExistingPile(eventData) {
    let pile;
    let fromPile = eventData.fromPile;

    switch (fromPile) {
        case "playArea":
            pile = gameState.cardsInOpponentPlay;
            break;
        case "playerHand":
            pile = gameState.cardsInOpponentsHand;
            break;
        case "playerDiscard":
            pile = gameState.cardsInOpponentsDiscard;
            break;
        case "playerDeadPile":
            pile = gameState.cardsInOpponentDeadPile;
            break;
        case "playerDeck":
            pile = gameState.cardsInOpponentDrawDeck;
            break;
        default:
            if (fromPile.includes("site")) {
                console.log("FromPile is a site, finding card from another site.")
                return findCardFromOtherSite(eventData);
            } else {
                console.log("Invalid pile to search");
            }
            break;
    }
    if (pile) {
        let card = pile.find(card => card && (card.ref === eventData.cardRef));
        if (card) {
            const index = pile.indexOf(card);
            if (index !== -1) {
                pile.splice(index, 1);
                return card;
            } else {
                console.error("Found target card, but no index? Program error");
            }
        }
    }
    return null;
}


function commonRemoteCardAction(eventData, toPile) {
    // Find an existing card in one of the opponents piles (based on "fromPile" tag)
    // and place it into the target pile.
    let existingCard = findCardFromExistingPile(eventData);
    if (existingCard) {
        console.log("Moving existing card(%d)", existingCard.cardRef)
        existingCard.x = eventData.position.x;
        existingCard.y = eventData.position.y;
        toPile.push(existingCard);
    } else {
        console.log("New card played")
        let card = initCard(eventData.cardId);
        card.ref = eventData.cardRef; // override uuid generated ref.
        card.x = eventData.position.x;
        card.y = eventData.position.y;
        toPile.push(card);
    }
    // Push to top of stack.
}

function handleRemotePlayAreaCard(eventData) {
    commonRemoteCardAction(eventData, gameState.cardsInOpponentPlay);
}

function handleRemotePlayerHand(eventData) {
    commonRemoteCardAction(eventData, gameState.cardsInOpponentsHand);
}

function handleRemotePlayerDiscard(eventData) {
    commonRemoteCardAction(eventData, gameState.cardsInOpponentsDiscard);
}

function handleRemotePlayerDeadPile(eventData) {
    commonRemoteCardAction(eventData, gameState.cardsInOpponentDeadPile)
}

function handleRemotePlayerSite(eventData) {
    const siteNum = parseInt(eventData.toPile.slice("site".length));
    let siteNumIdx = siteNum - 1;

    if (siteNumIdx < 0 || siteNumIdx >= siteSlots.length) {
        console.error("invalid site Number")
        return;
    }
    if (gameState.cardsInSiteSlots[siteNumIdx] ) {
        console.error("Card already exists in our site(%d), logic error?", siteNum)
        return;
    }
    if (gameState.cardsInOpponentSite[siteNumIdx]) {
        console.error("Card already exists for opponent in that site(%d)", siteNum);
    }
    // Lets check if it moved from an existing area( player Hand, etc)
    let existingCard = findCardFromExistingPile(eventData);
    if (existingCard) {
        console.log("Moving existing  card(%d)", existingCard.cardRef)
        existingCard.x = siteSlots[siteNumIdx].x
        existingCard.y = siteSlots[siteNumIdx].y
        gameState.cardsInOpponentSite[siteNumIdx] = existingCard;
    } else {
        console.log("New card played")
        let card = initCard(eventData.cardId);
        card.ref = eventData.cardRef; // override uuid generated ref.
        card.x = siteSlots[siteNumIdx].x;
        card.y = siteSlots[siteNumIdx].y
        gameState.cardsInOpponentSite[siteNumIdx] = card;
    }
}

// ========================================================
// Remote events.
// ========================================================
// UI and remote events:
document.getElementById("gatherButton").addEventListener("click", () => {
    handleGatherAndShuffleCards();
    draw();
});

document.addEventListener('cardAdded', (msg) => {
    console.log("Got a card added event message: %s", msg.detail)
    if (cardLibrary[msg.detail]) {
        let newCard = {
            id: msg.detail, x: 50, y: 50, z: 0,
            width: CARD_WIDTH, height: CARD_HEIGHT,
            isDragged: false, isHover: false
        };
        gameState.cardsInPlay.push(newCard);
    }
    draw();
})

document.addEventListener('playerJoined', (playerName, deckSize) => {
    console.log("canvas: Player joined(%s), clearing board, starting Deck is :%d", playerName, deckSize)
    // Create/ show opposing players info.
    gameState.cardsInOpponentPlay = [];
    gameState.cardsInOpponentsHand = [];
    gameState.cardsInOpponentsDiscard = [];
    gameState.cardsInOpponentDeadPile = [];
    gameState.cardsInOpponentDrawDeck = [];

    // Probably _not_ the best place to send this event, likely want a SM.
    sendDeckInitialized(gameState.cardsInDrawDeck.length);

    draw();
});


document.addEventListener('remoteCardEvent', (msg) => {
    console.log("Received a remote card Event : {}", msg.detail);
    const eventData = msg.detail;

    switch (eventData.toPile) {
        case "playArea":
            handleRemotePlayAreaCard(eventData);
            break;
        case "playerHand":
            handleRemotePlayerHand(eventData);
            break;
        case "playerDiscard":
            handleRemotePlayerDiscard(eventData);
            break;
        case "playerDeadPile":
            handleRemotePlayerDeadPile(eventData);
            break;
        default:
            if (eventData.toPile.includes("site")) {
                handleRemotePlayerSite(eventData);
                break;
            }
    }
    draw();
});

function handleOpponentDeckLoaded(eventData) {
    // probably a better way to do this.
    console.log("Lazily initializing opponent draw deck")
    let placeHolder =  initCard("LOTR-0000");
    placeHolder.ref = 0;
    for (let i = 0; i < eventData.deckSize; i++) {
        gameState.cardsInOpponentDrawDeck.push(placeHolder);
    }
}

console.log("Setting up event listener for remoteGameEvent")
document.addEventListener('remoteGameEvent', (msg) =>{
    console.log("received a remote game event : %s", JSON.stringify(msg.detail, null, 2));
    const eventData = msg.detail;

    switch(eventData.type) {
        case "deckInitialized":
            handleOpponentDeckLoaded(eventData);
            break;
        default:
            console.error("Unhandled gameEvent: %s", eventData.type)
            break;
    }
    draw();
})

document.addEventListener('gameStarted', (msg) => {
    console.log("Game has officially started")
    // playSound("sword-clash")
})

// Initial draw
draw();
