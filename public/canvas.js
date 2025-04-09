import { LOTR_STARTER_DECK_ARAGORN } from "./decks.js";
import { initializePlayerDeck } from "./decks.js";

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

let aspectRatio = 7680 / 4320;

aspectRatio = aspectRatio * 0.9;
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
const MAX_CARDS_IN_HAND = 12;

// base scale coordinates in percentages?
// const CARD_ASPECT_RATIO = 1.39
// const CARD_WIDTH = 714 / 5;
// const CARD_HEIGHT = CARD_ASPECT_RATIO*CARD_WIDTH;

// const SITE_CARD_HEIGHT = 10.0;
// const SITE_CARD_WIDTH = SITE_CARD_HEIGHT*CARD_ASPECT_RATIO;
// const MAX_CARDS_IN_HAND = 12;
// const PLAYER_HAND_OFFSET = 50;
// const CARD_PREVIEW_SHIFT = 20;
// const CARD_PREVIEW_SCALE_FACTOR = 3.0;
// const OPPONENT_HAND_OFFSET = 40


const CARD_SCALE = 0.8;
const CARD_WIDTH = 0.085 * CARD_SCALE;
const CARD_HEIGHT = 0.20 * CARD_SCALE;

const SITE_CARD_X = 0.030;
const SITE_CARD_Y = 0.030;

const SITE_CARD_WIDTH = .1;
const SITE_CARD_HEIGHT = .105;

const PLAYER_HAND_OFFSET = 0.025;
const CARD_PREVIEW_SHIFT = 0.02;
const CARD_PREVIEW_SCALE_FACTOR = 3.0;
const GAP = 0.005;
const OPPONENT_HAND_OFFSET = 0.05;
const DRAW_DECK_SHIFT = 0.0025;
const DRAG_THRESHOLD = 0.015;


// Define the "snap area" (a target area where cards should snap when dropped)
const playerHand = {
    x: 0.25, y: 1.0 - (CARD_HEIGHT + .015),
    width: CARD_WIDTH * 5, height: CARD_HEIGHT
}

// Define the "snap area" (a target area where cards should snap when dropped)
const drawDeck = {
    x: playerHand.x + playerHand.width + GAP, y: playerHand.y,
    width: CARD_WIDTH, height: CARD_HEIGHT
}

const discardPile = {
    x: drawDeck.x + drawDeck.width + GAP, y: playerHand.y,
    width: CARD_WIDTH, height: CARD_HEIGHT
}

const deadPile = {
    x: discardPile.x + discardPile.width + GAP, y: playerHand.y,
    width: SITE_CARD_WIDTH, height: SITE_CARD_HEIGHT
}

const supportZone = {
    x: playerHand.x, y: playerHand.y - (CARD_HEIGHT + GAP),
    width: playerHand.width, height: playerHand.height
}

const companionZone = {
    x: supportZone.x, y: supportZone.y - (CARD_HEIGHT + GAP),
    width: playerHand.width, height: playerHand.height
}
// Opponent card hand areas
const opponentDeadPile = {
    x: SITE_CARD_WIDTH + GAP, y: 30,
    width: SITE_CARD_WIDTH, height: SITE_CARD_HEIGHT
}
const opponentDiscardPile = {
    x: opponentDeadPile.x + opponentDeadPile.width + GAP, y: OPPONENT_HAND_OFFSET,
    width: CARD_WIDTH, height: CARD_HEIGHT
}

const opponentDeck = {
    x: opponentDiscardPile.x + opponentDiscardPile.width + GAP, y: OPPONENT_HAND_OFFSET,
    width: CARD_WIDTH, height: CARD_HEIGHT
}

const opponentHand = {
    x: opponentDeck.x + opponentDeck.width + GAP, y: OPPONENT_HAND_OFFSET,
    width: CARD_WIDTH * 4, height: CARD_HEIGHT
}

const siteSlots = [];
for (let i = 0; i < 9; i++) {
    siteSlots.push({
        x: SITE_CARD_X,
        y: SITE_CARD_Y + ((SITE_CARD_HEIGHT) * i),
        width: SITE_CARD_WIDTH, height: SITE_CARD_HEIGHT
    });
}


// Card object structure, top of cards is "top of stack"
const uiState = {
    mouseX: 0.0,
    mouseY: 0.0,
    startX: 0.0,
    startY: 0.0,
    activelySelectedCard: null,
    discardPreviewActive: false
}
const gameState = {
    playerName: "",
    gameId: "",

    cardsInPlay: [],
    cardsInPlayerHand: [],
    cardsInPlayerDiscard: [],
    cardsInSiteSlots: [],
    cardsInPlayerDeadPile: [],
    cardsInDrawDeck: [],
    cardsInSupportArea: [],
    cardsInCompanionSlots: [],

    cardsInOpponentPlay: [],
    cardsInOpponentsHand: [],
    cardsInOpponentsDiscard: [],
    cardsInOpponentDeadPile: [],
    cardsInOpponentDrawDeck: [],
    cardsInOpponentSite: [],
    cardsInOpponentSupportArea: [],
    cardsInOpponentCompanionSlots: [],
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
        isHover: false,
        // TODO -> Add what pile it resides in.
    }
}

function sendGameEvent(event) {
    console.log("Dispatching gameEvent: %s", JSON.stringify(event, null, 2))
    document.dispatchEvent(new CustomEvent("gameEvent", { detail: event }));
}

function sendDeckInitialized(deckSize) {
    let deckLoadedEvent = {
        type: "deckInitialized",
        deckSize: deckSize,
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
        /*
                "cardNumber": values[0],
                "cardName": values[1].replace('|', ','),
                "cardId": values[2],
                "cardSide": values[3],
                "cardType": values[4],
                "cardSiteNum": values[5].trim()
        */

        gameState.cardsInDrawDeck.push(initCard(cardObj.cardId));
    })

    sendDeckInitialized(initialDeck.length)
}

await initCardDeck();



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
// Game board drawing code primitives (probably needs to be react.js 'ified.)
// ============================================================
function getScale() {
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

function drawRect(area, text = "", fillStyle = 'rgba(255, 255, 255, 0.5') {
    let x = area.x * canvas.width;
    let y = area.y * canvas.height;
    let width = area.width * canvas.width;
    let height = area.height * canvas.height;

    ctx.fillStyle = fillStyle;
    ctx.fillRect(x, y, width, height);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(x, y, width, height);

    drawText(text, x + width / 2, y + height / 2)
}

function drawGradientRect(area, text) {
    // percentage adjusted.
    let x = area.x * canvas.width;
    let y = area.y * canvas.height;
    let width = area.width * canvas.width;
    let height = area.height * canvas.height;

    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.5)');

    ctx.fillStyle = grad;
    ctx.fillRect(x, y, width, height);

    ctx.strokeStyle = '#000';
    ctx.strokeRect(x, y, width, height);

    drawText(text, x + width / 2, y + height / 2);
}

// Card drawing primitives.c

// Draw the actual card based on its position/motion/animation info.
function drawCard(card, shadowColor = null) {
    let x = card.x * canvas.width;
    let y = card.y * canvas.height;
    let w = card.width * canvas.width;
    let h = card.height * canvas.height;

    let isActiveCard = (card === uiState.activelySelectedCard);
    // Draw semi transparent card
    ctx.fillStyle = isActiveCard ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 1.0)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    // Draw the PNG image inside the card
    const cardImage = getCardImage(card.id)
    if (cardImage) {
        if (cardImage.complete) {   // Make sure the image is loaded
            ctx.save()
            if (shadowColor) {
                ctx.shadowColor = shadowColor;
                ctx.shadowBlur = 20;
            }
            ctx.drawImage(cardImage, x, y, w, h);
            ctx.restore();
        }
    }
    let cardText = "Card id:" + card.id + "card ref:" + card.ref
    drawCardText(cardText, x + w / 2, y + h / 2)
}

function drawCardRotated(card, angle, shadowColor = null) {
    console.log("Drawing rotated site")
    const cardImage = getCardImage(card.id);
    const x = card.x * canvas.width;
    const y = card.y * canvas.height;
    const w = card.width * canvas.width;
    const h = card.height * canvas.height;
    let isActiveCard = (card === uiState.activelySelectedCard);
    if (!cardImage || cardImage.complete === false) {
        return;
    }

    ctx.save();
    ctx.fillStyle = isActiveCard ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 1.0)';
    ctx.translate(x, y); // set rotation point.
    ctx.rotate(angle * (Math.PI / 180)); // Convert degrees to radians

    ctx.fillRect(0, -h, w, h);
    ctx.strokeRect(0, -h, w, h);
    if (shadowColor) {
        ctx.shadowColor = shadowColor;
        ctx.shadowBlur = 20;
    }
    ctx.drawImage(cardImage, 0, -h, w, h);
    ctx.restore();
}

function drawCardReverse(card) {
    const x = card.x * canvas.width;
    const y = card.y * canvas.height;
    const w = card.width * canvas.width;
    const h = card.height * canvas.height;;

    ctx.fillStyle = 'rgba(255, 255, 255, 1.0)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeRect(x, y, w, h);

    // Draw the PNG image inside the card
    const cardImage = cardLibrary["lotrbackground"]
    if (cardImage.complete) {   // Make sure the image is loaded
        ctx.drawImage(cardImage, x + 1, y, w, h);
    }
}

// Draw an expanded card for easier view, only on hover in player hand.
function drawCardPreview(card, drawUnder = false) {
    let cardPreview = { ...card };
    cardPreview.width *= CARD_PREVIEW_SCALE_FACTOR;
    cardPreview.height *= CARD_PREVIEW_SCALE_FACTOR;
    if (drawUnder) {
        cardPreview.y = card.y + card.height + GAP
    } else {
        cardPreview.y = cardPreview.y - cardPreview.height - GAP;
    }
    drawCard(cardPreview)
}

function drawSpreadPile(pile) {
    // Draw cards statically in hand
    pile.forEach(card => {
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
}

// ============================================================
// Card drawing logic
// ============================================================

// Player Borders
function drawDiscardPileBorder() {
    drawRect(discardPile, "DISCARD");
}

function drawDrawDeckBorder() {
    drawRect(drawDeck, "DRAW EMPTY");
}

function drawDeadPileBorder() {
    drawRect(deadPile, "DEADPILE")
}

function drawPlayerHandGradient() {
    drawGradientRect(playerHand, "PLAYER HAND")
}

function drawCompanionZone() {
    // TODO Flexible drawing.
    drawRect(companionZone, "Place Companions Here");
}

function drawSupportZone() {
    drawRect(supportZone, "Place support cards here")
}

function drawSiteBorders() {
    let i = 0;
    siteSlots.forEach(siteSlot => {
        let siteName = "Site " + (i + 1);
        drawRect(siteSlot, siteName);
        i++;
    })
}

// Player Card piles
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

//
// Draw all the cards in a players hand, and if they are hovering over a card, an enlarged one.
function drawPlayerHand() {
    drawSpreadPile(gameState.cardsInPlayerHand)
}

function drawPlayerSupportArea() {
    drawSpreadPile(gameState.cardsInSupportArea)
}

function drawPlayerCompanionArea() {
    drawSpreadPile(gameState.cardsInCompanionSlots)
}

function drawDiscardPile() {
    // The preview popup handles drawing these cards.
    if (uiState.discardPreviewActive) {
        return;
    }
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

// Draw stack.
function drawDrawDeck() {
    let numCardsInDrawDeck = gameState.cardsInDrawDeck.length
    if (numCardsInDrawDeck > 0) {
        for (let i = 0; i < numCardsInDrawDeck; i++) {
            gameState.cardsInDrawDeck[i].x = drawDeck.x + DRAW_DECK_SHIFT * Math.floor(Math.sqrt(i));
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


function drawDeadPile() {
    let numCardsInDeadPile = gameState.cardsInPlayerDeadPile.length
    if (numCardsInDeadPile > 0) {
        drawCardRotated(gameState.cardsInPlayerDeadPile[numCardsInDeadPile - 1], 90);
    }
}

function drawSiteCard(card, shadowColor) {
    drawCardRotated(card, 90, shadowColor)
    if (card.isHover) {
        drawCardPreview(card); // needs to be rotated
    }
}

function drawSiteCards() {
    for (let i = 0; i < gameState.cardsInSiteSlots.length; i++) {
        if (gameState.cardsInSiteSlots[i]) {
            console.log("Drawing site %d card", i)
            drawSiteCard(gameState.cardsInSiteSlots[i], 'white')
        }
    }
}
function drawOpponentCardsInPlay() {
    gameState.cardsInOpponentPlay.forEach(card => {
        if (card.isHover) {
            drawCard(card, 'red')
            drawCardPreview(card)
        } else {
            drawCard(card, 'red');
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
            gameState.cardsInOpponentDrawDeck[i].x = opponentDeck.x + DRAW_DECK_SHIFT * Math.floor(Math.sqrt(i));
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


function drawOpponentSiteCards() {
    for (let i = 0; i < gameState.cardsInOpponentSite.length; i++) {
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



function drawStaticSnapZones() {
    drawSiteBorders();
    drawCompanionZone();
    drawSupportZone();
    drawPlayerHandGradient();
    drawDiscardPileBorder();
    drawDrawDeckBorder();

    drawDeadPileBorder();
    drawOpponentArea();
}

function drawPlayerCards() {
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

    drawPlayerSupportArea()
    drawPlayerCompanionArea()
}

function drawOpponentCards() {
    drawOpponentCardsInPlay();
    drawOpponentDiscardPile();
    drawOpponentDeck();
    drawOpponentHand();
    drawOpponentSiteCards();
}

function drawDiscardPreview() {
    let discardPreviewArea = { x: 0.10, y: 0.10, width: 0.80, height: 0.70 }
    drawRect(discardPreviewArea, "Discard Pile here", 'rgba (127, 127, 127, 0.9');

    let numCardsInDiscard = gameState.cardsInPlayerDiscard.length;
    for (let i = 0; i < numCardsInDiscard; i++) {
        let card = gameState.cardsInPlayerDiscard[i];
        card.x = discardPreviewArea.x + (i % 10) * CARD_WIDTH;
        card.y = discardPreviewArea.y + Math.floor(i / 10) * CARD_HEIGHT;
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

function drawPopups() {
    if (uiState.discardPreviewActive) {
        drawDiscardPreview();
    }
}

function draw() {
    // Draw background image (TODO change each game or add option to change.)
    drawBackground();
    drawStaticSnapZones();
    drawOpponentCards();
    drawPlayerCards();

    drawPopups();
}




// ================================================
// IPC handling and sending
// ================================================

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
        position: { x: card.x, y: card.y }, // only relevant for in play cards.
        playerId: gameState.playerName
    }
    console.log("Dispatching cardMovedEvent: %s", JSON.stringify(event, null, 2))
    document.dispatchEvent(new CustomEvent("cardEvent", { detail: event }));
}

function placeCardInHand(from, card) {
    console.log("Placing %s into hand", card.id)

    // Snap to end of hand location
    let numCardsInHand = gameState.cardsInPlayerHand.length;

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
    console.log("Moving card onto table id:%s", card.id)
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
    console.log("Adding card to dead pile id:%s", card.id)

    gameState.cardsInPlayerDeadPile.push(card)

    card.x = deadPile.x
    card.y = deadPile.y

    sendCardMovedEvent(from, "playerDeadPile", card)
}

function placeCardAtSite(from, card, siteNum) {
    console.log("Adding card to site :%d", (siteNum+1))

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

function handleSitePlacement(from, card) {
    for (let i = 0; i < siteSlots.length; i++) {
        let site = siteSlots[i]
        if (mouseInSnapArea(site)) {
            return placeCardAtSite(from, card, i);
        }
    }
    return false
}

function placeCardInSupportPile(from, card) {
    console.log("Placing into supportArea id:%s", card.id)

    // Snap to end of hand location
    let numCardsInPile = gameState.cardsInSupportArea.length;
    gameState.cardsInSupportArea.push(card)

    // Reshuffle/organize playerhand
    for (let i = numCardsInPile; i >= 0; i--) {
        let card = gameState.cardsInSupportArea[i];
        card.x = supportZone.x + 2 * i * PLAYER_HAND_OFFSET;
        card.y = supportZone.y;
    }

    sendCardMovedEvent(from, "supportArea", card)
}

function placeCardInCompanionPile(from, card) {
    console.log("Placing %s into companionArea", card.id)

    // Snap to end of hand location
    let numCardsInPile = gameState.cardsInCompanionSlots.length;
    gameState.cardsInCompanionSlots.push(card)

    // Reshuffle/organize playerhand
    for (let i = numCardsInPile; i >= 0; i--) {
        let card = gameState.cardsInCompanionSlots[i];
        card.x = companionZone.x + 2 * i * PLAYER_HAND_OFFSET;
        card.y = companionZone.y;
    }

    sendCardMovedEvent(from, "companionArea", card)
}

// Card moved from origin, figure out where it went.
function handleGenericCardMoved(from, selectedCard) {
    const dropZones = [
        { area: playerHand, action: placeCardInHand },
        { area: discardPile, action: placeCardInDiscard },
        { area: companionZone, action: placeCardInCompanionPile },
        { area: supportZone, action: placeCardInSupportPile },
        { area: deadPile, action: placeCardInDeadPile },
    ]

    for (const zone of dropZones) {
        if (mouseInSnapArea(zone.area)) {
            zone.action(from, selectedCard);
            return;
        }
    }

    if (handleSitePlacement(from, selectedCard)) {
        console.log("Site place handled, done with handleGenericMoved;")
    } else {
        placeCardOnPlayArea(from, selectedCard);
    }
}

function handleDiscardCardTapped() {

    if (uiState.discardPreviewActive == false) {
        console.log("Show a preview of discard to pull from");
        uiState.discardPreviewActive = true;
    } else {
        // discard Preview is already active, someone is tapping a discard from within the pile to remove it.
        console.log("Removing card from discard;")
        for (let i = gameState.cardsInPlayerDiscard.length - 1; i >= 0; i--) {
            let card = gameState.cardsInPlayerDiscard[i];
            if (card === uiState.activelySelectedCard) {
                const selectedCard = gameState.cardsInPlayerDiscard.splice(i, 1)[0];
                placeCardInHand("playerDeck", selectedCard);
                break;
            }
        }
    }
}

function resetDiscardPreview() {
    gameState.cardsInPlayerDiscard.forEach(card => {
        card.x = discardPile.x;
        card.y = discardPile.y;
    });
    uiState.discardPreviewActive = false;
}

function handleGenericCardTapped(fromPile, pile) {
    const clickActions = {
        "playerHand": null,
        "playerDiscard": handleDiscardCardTapped
    }
    if (clickActions[fromPile] != null) {
        console.log("Handling click action for pile:%s", fromPile);
        clickActions[fromPile]();
    } else {
        if (uiState.discardPreviewActive) {
            resetDiscardPreview();
        }
    }
}

function checkCardReleased(tapped, fromPile, pile) {
    for (let i = pile.length - 1; i >= 0; i--) {
        let card = pile[i];
        if (card === uiState.activelySelectedCard) {

            if (tapped) {
                handleGenericCardTapped(fromPile, card);
            } else {
                console.log("Removing a card and handling it generically");
                const selectedCard = pile.splice(i, 1)[0];
                handleGenericCardMoved(fromPile, selectedCard);
            }
            uiState.activelySelectedCard = null;
            return true;
        }
    }
    return false;
}

function handleSiteSlotsRelease() {
    for (let i = 0; i < gameState.cardsInSiteSlots.length; i++) {
        let card = gameState.cardsInSiteSlots[i];
        if (card && card === uiState.activelySelectedCard) {

            handleGenericCardMoved("site" + (i + 1), card);
            delete gameState.cardsInSiteSlots[i];
            uiState.activelySelectedCard = null;
            return true;;
        }
    }
    return false;
}

// Cards from deck immediately go into player Hand.
function handleDrawDeckRelease() {
    if (gameState.cardsInDrawDeck.length > 0) {
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

// ============================================================
// Interaction management / gen UI.
// ============================================================

// Handle mouse up event to stop dragging and snap the card
canvas.addEventListener('mouseup', () => {
    let dX = uiState.mouseX - uiState.startX;
    let dY = uiState.mouseY - uiState.startY;
    let dist = Math.sqrt(dX * dX + dY * dY)
    let tapped = dist < DRAG_THRESHOLD;

    // Modifying cards while looping through it?? ehh..
    checkCardReleased(tapped, "playArea", gameState.cardsInPlay)
    checkCardReleased(tapped, "playerHand", gameState.cardsInPlayerHand);
    checkCardReleased(tapped, "playerDiscard", gameState.cardsInPlayerDiscard);
    checkCardReleased(tapped, "playerDeadPile", gameState.cardsInPlayerDeadPile);
    checkCardReleased(tapped, "playerSupportArea", gameState.cardsInSupportArea);
    checkCardReleased(tapped, "playerCompanionZone", gameState.cardsInCompanionSlots);

    handleSiteSlotsRelease(tapped);
    handleDrawDeckRelease(tapped);

    draw();
});


// Check if the mouse is over a card
function isMouseOverCard(card) {
    return uiState.mouseX >= card.x && uiState.mouseX <= card.x + card.width &&
        uiState.mouseY >= card.y && uiState.mouseY <= card.y + card.height;
}

function isMouseOverCardRotated(card) {
    return uiState.mouseX >= card.x && uiState.mouseX <= card.x + card.height &&
        uiState.mouseY >= card.y && uiState.mouseY <= card.y + card.width;
}

function mouseInSnapArea(snapArea) {
    return uiState.mouseX >= snapArea.x && uiState.mouseX <= snapArea.x + snapArea.width &&
        uiState.mouseY >= snapArea.y && uiState.mouseY <= snapArea.y + snapArea.height;
}

// Handle mouse down event to start dragging a card
canvas.addEventListener('mousedown', (e) => {
    uiState.mouseX = e.offsetX / canvas.width;
    uiState.mouseY = e.offsetY / canvas.height;
    uiState.startX = uiState.mouseX
    uiState.startY = uiState.mouseY

    const cardPiles = [
        { cards: gameState.cardsInPlayerHand, vertical: true },
        { cards: gameState.cardsInPlayerDiscard, vertical: true },
        { cards: gameState.cardsInPlay, vertical: true },
        { cards: gameState.cardsInSupportArea, vertical: true },
        { cards: gameState.cardsInCompanionSlots, vertical: true },
        { cards: gameState.cardsInSiteSlots, vertical: false },
        { cards: gameState.cardsInPlayerDeadPile, vertical: false }
    ]

    // Check every pile of playerCards to see if a card was selected.
    for (let cardPile of cardPiles) {
        let pile = cardPile.cards;
        for (let i = pile.length - 1; i >= 0; i--) {
            let card = pile[i];
            if (card) {
                const isSelected = (cardPile.vertical && isMouseOverCard(card))
                    || (!cardPile.vertical && isMouseOverCardRotated(card));
                if (isSelected) {
                    console.log("mousedown event for %s", card.id);
                    if (uiState.activelySelectedCard) {
                        console.error("Card (%s) is already selected???", uiState.activelySelectedCard.id);
                    }
                    uiState.activelySelectedCard = card;
                    return;
                }
            }
        }
    }
});


function handleCardDragged() {
        uiState.activelySelectedCard.x = uiState.mouseX - uiState.activelySelectedCard.width / 2;
        uiState.activelySelectedCard.y = uiState.mouseY - uiState.activelySelectedCard.height / 2;
}

function checkForHover() {
    const cardPiles = [
        { cards: gameState.cardsInPlayerHand, vertical: true },
        { cards: gameState.cardsInPlayerDiscard, vertical: true },
        { cards: gameState.cardsInPlay, vertical: true },
        { cards: gameState.cardsInSupportArea, vertical: true },
        { cards: gameState.cardsInCompanionSlots, vertical: true },
        { cards: gameState.cardsInSiteSlots, vertical: false },
        { cards: gameState.cardsInPlayerDeadPile, vertical: false }
    ]

    let hoverSet = false;
    // Check every pile of playerCards to see if a card was selected.
    for (let cardPile of cardPiles) {
        let pile = cardPile.cards;
        for (let i = pile.length - 1; i >= 0; i--) {
            let card = pile[i];
            if (card) {
                const isSelected = (cardPile.vertical && isMouseOverCard(card))
                    || (!cardPile.vertical && isMouseOverCardRotated(card));
                card.isHover = false;
                if (isSelected && !hoverSet) {
                    hoverSet = true;
                    card.isHover = true;
                    // Sorry no early break, we need to "unset" other card hovers.
                }
            }
        }
    }
}

// Handle mouse move event to drag the card
canvas.addEventListener('mousemove', (e) => {
    uiState.mouseX = e.offsetX / canvas.width;
    uiState.mouseY = e.offsetY / canvas.height;
    // Draw drag movement.
    if (uiState.activelySelectedCard) {
        handleCardDragged()
    } else {
        checkForHover()
    }
    draw();
});



//
// Handle opponent card moves
//
function findCardFromOtherSite(eventData) {
    for (let i = 0; i < gameState.cardsInOpponentSite.length; i++) {
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
    if (gameState.cardsInSiteSlots[siteNumIdx]) {
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
    moveStackToDrawDeck(gameState.cardsInSupportArea);
    moveStackToDrawDeck(gameState.cardsInCompanionSlots)
}
document.getElementById("gatherButton").addEventListener("click", () => {
    handleGatherAndShuffleCards();
    draw();
});

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
    let placeHolder = initCard("LOTR-0000");
    placeHolder.ref = 0;
    for (let i = 0; i < eventData.deckSize; i++) {
        gameState.cardsInOpponentDrawDeck.push(placeHolder);
    }
}

document.addEventListener('remoteGameEvent', (msg) => {
    console.log("received a remote game event : %s", JSON.stringify(msg.detail, null, 2));
    const eventData = msg.detail;

    switch (eventData.type) {
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

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerWidth / aspectRatio;
    draw();
}
window.addEventListener('resize', resizeCanvas);

// Initial draw
draw();
