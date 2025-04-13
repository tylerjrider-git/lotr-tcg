import { initializePlayerDeck } from "./decks.js";

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// game event enums.
const GAME_EVENT_DECK_INIT = "deckInitialized";
const GAME_EVENT_TWILIGHT_CHANGED = "twilightChanged";


// UI constants
const CARD_SCALE = 0.8;
const CARD_WIDTH = 0.085 * CARD_SCALE;
const CARD_HEIGHT = 0.20 * CARD_SCALE;

const CARD_PREVIEW_SHIFT = 0.02;
const CARD_PREVIEW_SCALE_FACTOR = 3.0;
const GAP = 0.005;
const DRAW_DECK_SHIFT = 0.0025;
const DRAG_THRESHOLD = 0.015;
const aspectRatio = 0.9 * (7680 / 4320);

canvas.width = window.innerWidth;
canvas.height = window.innerWidth / aspectRatio;

// Define the "snap area" (a target area where cards should snap when dropped)

// Game constants
const MAX_CARDS_IN_HAND = 12;
const MAX_NUMBER_COMPANIONS = 9;
const MAX_HEALTH = 6;

import * as Layout from "./layout.js"

const supportZone = Layout.supportZone;
const playerHand = Layout.playerHand;
const drawDeck = Layout.drawDeck;

const discardPile = Layout.discardPile;
const companionZone = Layout.companionZone;
const deadPile = Layout.deadPile;
const opponentDeadPile = Layout.opponentDeadPile;
const opponentDiscardPile = Layout.opponentDiscardPile;
const opponentDeck = Layout.opponentDeck;
const opponentHand = Layout.opponentHand;
const opponentSupportZone = Layout.opponentSupportZone;
const opponentCompanionZone = Layout.opponentCompanionZone;
const siteSlots = Layout.siteSlots;

// Card object structure, top of cards is "top of stack"
const uiState = {
    mouseX: 0.0,
    mouseY: 0.0,
    startX: 0.0,
    startY: 0.0,
    activelySelectedCard: null,
    discardPreviewActive: false,
    companionPreviewActive: false,
    companionPreviewCards: [],
    cardToPreview: null
}

const gameState = {
    opponentInitialized: false,
    playerInitialized: false,
    playerName: "",
    gameId: "",

    cardsInPlay: [],
    cardsInPlayerHand: [],
    cardsInPlayerDiscard: [],
    cardsInSiteSlots: [],
    cardsInPlayerDeadPile: [],
    cardsInDrawDeck: [],
    cardsInSiteDeck: [],
    cardsInSupportArea: [],
    companionSlots: [],

    cardsInOpponentPlay: [],
    cardsInOpponentsHand: [],
    cardsInOpponentsDiscard: [],
    cardsInOpponentDeadPile: [],
    cardsInOpponentDrawDeck: [],
    cardsInOpponentSite: [],
    cardsInOpponentSupportArea: [],
    cardsInOpponentCompanionSlots: [],

    activeCompanions: {},
}
function initCompanionSlots() {
    for (let i = 0; i < MAX_NUMBER_COMPANIONS; i++) {
        gameState.companionSlots[i] = []
        gameState.cardsInOpponentCompanionSlots[i] = []
    }
}
initCompanionSlots();

let uuid_ref = 0;
function initCard(_id, cardType, siteNum = 0) {
    uuid_ref++;

    return {
        id: _id, /* This is the refrence picture/name of card. May be multiple instances in deck/game */
        uuid: uuid_ref, /* unique identifier for this players instance of _id, unique per game */
        x: drawDeck.x, /* The current location of the card, may be in pile or on board*/
        y: drawDeck.y, /* ** */
        z: 0, /* unsued atm */
        width: CARD_WIDTH, /* Generally static unless a preview is made */
        height: CARD_HEIGHT, /* */
        cardType: cardType, /* Meta data about cardType (Companion/site/ring/condtion/etc),
                    may set condtions on where it can be played */
        siteNum: siteNum
    }
}

// Assets
let backgroundImage = new Image();
backgroundImage.src = 'assets/shire.jpg'
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

function sendGameEvent(event) {
    console.debug("Dispatching gameEvent: %s", JSON.stringify(event, null, 2))
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
        let card = initCard(cardObj.cardId, cardObj.cardType, cardObj.cardSiteNum)
        if (cardObj.cardType === "Site") {
            gameState.cardsInSiteDeck.push(card);
        } else {
            gameState.cardsInDrawDeck.push(card);
        };
    })

    sendDeckInitialized(initialDeck.length);

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

// Generic drawing of black text
function drawText(text, x, y, centered = true) {
    ctx.font = '10px "Uncial Antiqua", serif'; // Set font size and type
    ctx.fillStyle = 'black'; // Set text color
    if (centered) {
        const textWidth = ctx.measureText(text).width;
        x = x - textWidth / 2;
    }
    ctx.fillText(text, x, y); // Draw the text at position (50, 150)
}

function drawTextRel(text, x, y, centered = true) {
    x = x * canvas.width;
    y = y * canvas.height;

    ctx.font = '10px "Uncial Antiqua", serif'; // Set font size and type
    ctx.fillStyle = 'black'; // Set text color
    if (centered) {
        const textWidth = ctx.measureText(text).width;
        x = x - textWidth / 2;
    }
    ctx.fillText(text, x, y); // Draw the text at position (50, 150)
}


function drawRectR(area, text = "", fillStyle = 'rgba(255, 255, 255, 0.5') {
    let x = area.x * canvas.width;
    let y = area.y * canvas.height;
    let width = area.width * canvas.width;
    let height = area.height * canvas.height;


    ctx.beginPath();

    ctx.roundRect(x, y, width, height, 5);
    ctx.stroke();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.fillStyle = fillStyle;
    ctx.beginPath();
    ctx.roundRect(x, y, width, height, 5);
    ctx.stroke();
    ctx.fill();

    drawText(text, x + width / 2, y + height / 2)
}

function drawRect(area, text = "", fillStyle = 'rgba(255, 255, 255, 0.5') {
    let x = area.x * canvas.width;
    let y = area.y * canvas.height;
    let width = area.width * canvas.width;
    let height = area.height * canvas.height;

    ctx.fillStyle = fillStyle;
    ctx.fillRect(x, y, width, height);

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.rect(x, y, width, height, 15);
    ctx.stroke();

    drawText(text, x + width / 2, y + height / 2);
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
    let cardText = "Card id:" + card.id + "card ref:" + card.uuid
    //drawCardText(cardText, x + w / 2, y + h / 2)
}

function drawCardRotated(card, angle, shadowColor = null) {
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
function drawCardPreview(card) {
    let cardPreview = { ...card };
    let drawUnder = card.y < 0.5;
    cardPreview.width *= CARD_PREVIEW_SCALE_FACTOR;
    cardPreview.height *= CARD_PREVIEW_SCALE_FACTOR;
    if (drawUnder) {
        cardPreview.y = card.y + card.height + GAP
    } else {
        cardPreview.y = cardPreview.y - cardPreview.height - GAP;
    }
    drawCard(cardPreview)
}

function drawCardWithPreview(card, shadowColor = null, drawUnder = false) {
    let hover = isMouseOverCard(card);
    if (hover) {
        let offsetCard = { ...card }
        offsetCard.y = card.y - CARD_PREVIEW_SHIFT;
        drawCard(offsetCard, shadowColor)
        uiState.cardToPreview = offsetCard;
        // drawCardPreview(offsetCard, drawUnder)
    } else {
        drawCard(card, shadowColor);
    }
}
function drawSpreadPile(pile) {
    // Draw cards statically in hand
    pile.forEach(card => {
        // If mouse is hovering over a card in the player hand enlarge it.
        drawCardWithPreview(card);
    });
}

// ============================================================
// Card drawing logic
// ============================================================
function drawSiteBorders() {
    let i = 0;
    siteSlots.forEach(siteSlot => {
        let siteName = "Site " + (i + 1);
        drawRectR(siteSlot, siteName);
        i++;
    })
}

// Player Card piles
// Draw all "loose leaf" cards on the table.
function drawInPlayCards() {
    // Draw the cards
    gameState.cardsInPlay.forEach(card => {
        drawCardWithPreview(card)
    });
}

//
// Draw all the cards in a players hand, and if they are hovering over a card, an enlarged one.
function drawPlayerHand() {
    drawSpreadPile(gameState.cardsInPlayerHand)
    let numCardsInHand = gameState.cardsInPlayerHand.length;
}

function drawPlayerSupportCards() {
    drawSpreadPile(gameState.cardsInSupportArea)
}

function drawHealthBar(origin, companion) {
    const boxSize = GAP * 2;
    const gap = GAP / 2;
    const maxHealth = 6;
    let health = 5;
    const hX = origin.x
    const hY = origin.y + CARD_HEIGHT + GAP;

    const HEALTH_BAR_UNIT_WIDTH = CARD_WIDTH / maxHealth;
    const HEALTH_BAR_HEIGHT = 0.01;
    const HEALTH_BAR_ADJ = 0.01;


    drawRect({ x: hX, y: hY, width: HEALTH_BAR_UNIT_WIDTH * companion.currentHealth, height: HEALTH_BAR_HEIGHT }, "", 'red');

    // border

    drawRectR({ x: hX, y: hY, width: CARD_WIDTH, height: HEALTH_BAR_HEIGHT }, "", 'rgba(255,255,255,0.1)');

    drawTextRel("<", hX - 2 * GAP, hY + GAP, true);
}

function drawCompanionSlot(slot) {
    let companionSlot = gameState.companionSlots[slot];


    // Draw all the cards.
    companionSlot.forEach(card => {
        drawCardWithPreview(card);
    });

    // Draw info about health/ etc.
    if (companionSlot.length > 0) {
        let origin = { x: companionSlot[0].x, y: companionSlot[0].y }
        let companionCard = companionSlot[companionSlot.length - 1];
        if (gameState.activeCompanions[companionCard.uuid]) {
            drawHealthBar(origin, gameState.activeCompanions[companionCard.uuid]);
        }
    }
}

function drawPlayerCompanionCards() {
    // cardsInCompanionSlots should be "slots", and each have sub attachments.
    for (let i = 0; i < MAX_NUMBER_COMPANIONS; i++) {
        if (gameState.companionSlots[i]) {
            drawCompanionSlot(i);
        }
    }
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
        drawCardWithPreview(card);
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

function drawCompanionZones() {
    for (let i = 0; i < MAX_NUMBER_COMPANIONS; i++) {
        const rect = {
            x: companionZone.x + i * (CARD_WIDTH + GAP), y: companionZone.y,
            width: CARD_WIDTH, height: CARD_HEIGHT
        }
        drawRectR(rect)
    }
}

function drawSiteCard(card, shadowColor) {
    drawCardRotated(card, 90, shadowColor)
    let hover = isMouseOverCardRotated(card)
    if (hover) {
        drawCardPreview(card); // needs to be rotated
    }
}

function drawSiteCards() {
    for (let i = 0; i < gameState.cardsInSiteSlots.length; i++) {
        if (gameState.cardsInSiteSlots[i]) {
            drawSiteCard(gameState.cardsInSiteSlots[i], 'white')
        }
    }
}
function drawOpponentCardsInPlay() {
    gameState.cardsInOpponentPlay.forEach(card => {
        drawCardWithPreview(card, 'red')
    })
}

function drawOpponentDiscardPile() {
    let numCardsInDiscard = gameState.cardsInOpponentsDiscard.length
    if (numCardsInDiscard > 0) {
        // draw rotated.
        let card = gameState.cardsInOpponentsDiscard[numCardsInDiscard - 1]
        card.x = opponentDiscardPile.x;
        card.y = opponentDiscardPile.y;
        drawCardWithPreview(card);
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
        card.x = opponentHand.x + Layout.PLAYER_HAND_OFFSET * i;
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
function drawOpponentCompanionSlot(slot, offset) {
    let i = 0;
    slot.forEach(card => {
        card.x = offset.x + i * (Layout.PLAYER_HAND_OFFSET);
        card.y = offset.y;
        i++;
        drawCardWithPreview(card, 'red', true);
    });
}

function drawOpponentCompanionCards() {
    for (let i = 0; i < MAX_NUMBER_COMPANIONS; i++) {
        let offset = { x: opponentCompanionZone.x + i * (CARD_WIDTH + GAP), y: opponentCompanionZone.y }
        drawOpponentCompanionSlot(gameState.cardsInOpponentCompanionSlots[i], offset);
    }

}

function drawOpponentSupportCards() {
    let i = 0;
    gameState.cardsInOpponentSupportArea.forEach(card => {
        card.x = opponentSupportZone.x + Layout.PLAYER_HAND_OFFSET * i;
        card.y = opponentSupportZone.y;
        i++;
        drawCard(card);
    });
}

function drawOpponentCompanionZones() {
    for (let i = 0; i < MAX_NUMBER_COMPANIONS; i++) {
        const rect = {
            x: opponentCompanionZone.x + i * (CARD_WIDTH + GAP), y: opponentCompanionZone.y,
            width: CARD_WIDTH, height: CARD_HEIGHT
        }
        drawRectR(rect)
    }
}


function drawDiscardPreview() {
    drawRectR(Layout.discardPreviewArea, "Discard Pile here", 'rgba(255, 255, 255, 0.5');
    const numCardsInDiscard = gameState.cardsInPlayerDiscard.length;
    for (let i = 0; i < numCardsInDiscard; i++) {
        let card = gameState.cardsInPlayerDiscard[i];
        card.x = Layout.discardPreviewArea.x + (i % 10) * CARD_WIDTH;
        card.y = Layout.discardPreviewArea.y + Math.floor(i / 10) * CARD_HEIGHT;
        drawCardWithPreview(card)
    }
}

function drawCompanionPreview() {
    drawRectR(Layout.companionPreviewArea, "", 'rgba(128, 128, 128, 0.8');
    let i = 0;
    uiState.companionPreviewCards.forEach(card => {
        card.x = Layout.companionPreviewArea.x + (i % 9) * (GAP + CARD_WIDTH);
        card.y = Layout.companionPreviewArea.y;
        drawCardWithPreview(card);
        i++;
    })
}


function drawOpponentArea() {
    drawRectR(opponentDeadPile, "Dead Pile")
    drawRectR(opponentDiscardPile, "Discard Pile")
    drawRectR(opponentHand, "Hand")
    drawRectR(opponentDeck, "Deck")
    drawRectR(opponentSupportZone, "Support")
    drawOpponentCompanionZones(opponentCompanionZone, "Companion")
}


function drawStaticSnapZones() {
    drawSiteBorders();
    drawRectR(supportZone, "Support")
    drawRectR(playerHand, "Hand");
    drawRectR(discardPile, "Discard");
    drawRectR(drawDeck, "Deck empty");
    drawRectR(deadPile, "Deadpile");
    drawCompanionZones();

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


    drawPlayerSupportCards()
    drawPlayerCompanionCards()
}

function drawOpponentCards() {
    drawOpponentCardsInPlay();
    drawOpponentDiscardPile();
    drawOpponentDeck();
    drawOpponentHand();
    drawOpponentSiteCards();
    drawOpponentCompanionCards();
    drawOpponentSupportCards();
}


function drawPopups() {
    let popupActive = (uiState.discardPreviewActive || uiState.companionPreviewActive);
    if (popupActive) {
        drawRectR({ x: 0, y: 0, width: 1.0, height: 1.0 }, "", 'rgba(0, 0, 0, 0.7)')
    }
    if (uiState.discardPreviewActive) {
        drawDiscardPreview();
    } else if (uiState.companionPreviewActive) {
        drawCompanionPreview();
    }
    if (uiState.cardToPreview) {
        drawCardPreview(uiState.cardToPreview);
        uiState.cardToPreview = null
    }
}

function drawGrid() {
    for (let y = 0; y < 1.0; y) {
        let startX = 0.0;
        let startY = y * canvas.height;
        let endX = canvas.width;
        let endY = y * canvas.height;

        ctx.beginPath();         // Start a new path
        ctx.moveTo(startX, startY);      // Move to starting point (x1, y1)
        ctx.lineTo(endX, endY);    // Draw line to (x2, y2)
        ctx.strokeStyle = 'rgba(255.0, 0.0, 0.0, 1.0'; // Set line color
        ctx.lineWidth = 1;       // Set line thickness
        ctx.stroke();            // Actually draw the line
        y = y + 0.1
    }

    for (let x = 0; x < 1.0;) {

        let startX = x * canvas.width;
        let startY = 0.0;

        let endX = x * canvas.width;
        let endY = canvas.height;


        ctx.beginPath();         // Start a new path
        ctx.moveTo(startX, startY);      // Move to starting point (x1, y1)
        ctx.lineTo(endX, endY);    // Draw line to (x2, y2)
        ctx.strokeStyle = 'rgba(255.0, 0.0, 0.0, 1.0'; // Set line color
        ctx.lineWidth = 1;       // Set line thickness
        ctx.stroke();            // Actually draw the line
        x = x + 0.1
    }
}
let tick = 0;
function draw() {
    // Draw background image (TODO change each game or add option to change.)


    ctx.save(); // Save the current context state

    // Apply a transform that simulates a 45° angle look
    /*
        transform(a, b, c, d, e, f)

        a c e
        b d f
        0 0 1
    */
    //ctx.transform(1, 0, 0.0, 0.9, 0, 0)

    drawBackground();
    // drawGrid();
    drawStaticSnapZones();
    drawOpponentArea();
    drawOpponentCards();
    drawPlayerCards();

    // sites.
    drawSiteCards()
    drawPopups();

    //ctx.restore();
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

function sendCardMovedEvent(_from, _to, card, _index = 0) {
    let event = {
        type: "moveCard",
        cardId: card.id,
        cardUuid: card.uuid,
        cardType: card.cardType,
        fromPile: _from,
        toPile: _to,
        position: { x: card.x, y: card.y }, // only relevant for in play cards.
        playerId: gameState.playerName,
        index: _index // 
    }
    console.log("Dispatching cardMovedEvent: %s", JSON.stringify(event, null, 2))
    document.dispatchEvent(new CustomEvent("cardEvent", { detail: event }));
}

function placeCardInHand(from, card) {
    console.log("Placing %s into hand", card.id)

    // Snap to end of hand location
    let numCardsInHand = gameState.cardsInPlayerHand.length;

    // TODO: CHeck hand size.
    gameState.cardsInPlayerHand.push(card)

    // Reshuffle/organize playerhand
    for (let i = numCardsInHand; i >= 0; i--) {
        let card = gameState.cardsInPlayerHand[i];
        card.x = playerHand.x + i * Layout.PLAYER_HAND_OFFSET;
        card.y = playerHand.y;
    }
    sendCardMovedEvent(from, "playerHand", card);
    return true;
}

function placeCardOnPlayArea(from, card) {
    console.log("Moving card onto table id:%s", card.id)
    gameState.cardsInPlay.push(card)
    sendCardMovedEvent(from, "playArea", card);
    return true;
}

function placeCardInDiscard(from, card) {
    console.log("Discarding card id:%s", card.id)

    gameState.cardsInPlayerDiscard.push(card)

    card.x = discardPile.x;
    card.y = discardPile.y;

    sendCardMovedEvent(from, "playerDiscard", card);
    return true;
}

function placeCardInDeadPile(from, card) {
    console.log("Adding card to dead pile id:%s", card.id)

    gameState.cardsInPlayerDeadPile.push(card)

    card.x = deadPile.x
    card.y = deadPile.y

    sendCardMovedEvent(from, "playerDeadPile", card);
    return true;
}

function placeCardAtSite(from, card, siteNum) {
    console.log("Adding card to site :%d", (siteNum + 1))

    if (siteNum < siteSlots.length) {
        if (gameState.cardsInSiteSlots[siteNum] || gameState.cardsInOpponentSite[siteNum]) {
            console.log("Card already exists at site: %d", siteNum + 1)
        } else {
            gameState.cardsInSiteSlots[siteNum] = card;
            card.x = siteSlots[siteNum].x
            card.y = siteSlots[siteNum].y
            sendCardMovedEvent(from, "site", card, siteNum)
            return true;
        }
    }
    return false;
}

function handleSitePlacement(from, card) {
    for (let i = 0; i < siteSlots.length; i++) {
        let site = siteSlots[i]
        if (mouseInArea(site)) {
            return placeCardAtSite(from, card, i);
        }
    }
    return false;
}

function placeCardInSupportPile(from, card) {
    console.log("Placing into supportArea id:%s", card.id)

    // Snap to end of hand location
    let numCardsInPile = gameState.cardsInSupportArea.length;
    gameState.cardsInSupportArea.push(card)

    // Reshuffle/organize playerhand
    for (let i = numCardsInPile; i >= 0; i--) {
        let card = gameState.cardsInSupportArea[i];
        card.x = supportZone.x + i * Layout.PLAYER_HAND_OFFSET;
        card.y = supportZone.y;
    }

    sendCardMovedEvent(from, "playerSupportArea", card);
    return true;
}

function cardIsCompanionType(card) {
    return card.cardType == "Companion" || card.cardType == "RingBearer"
}

function restackCompanionSlot(slotNum) {
    const slotOrigin = { x: companionZone.x + slotNum * (CARD_WIDTH + GAP), y: companionZone.y }
    const companionSlot = gameState.companionSlots[slotNum];
    const numCardsInSlot = companionSlot.length;
    let offset = 0;
    let i = 0;

    for (i = 0; i < gameState.companionSlots[slotNum].length; i++) {
        let card = gameState.companionSlots[slotNum][i];
        if (cardIsCompanionType(card)) {
            break;
        }
    }

    // Found card below top of stack
    if (i < (numCardsInSlot - 1)) {
        let tmp = companionSlot[numCardsInSlot - 1];
        companionSlot[numCardsInSlot - 1] = companionSlot[i];
        companionSlot[i] = tmp;
    }
    // resize positions.

    gameState.companionSlots[slotNum].forEach(card => {
        // Draw stack of possesions/support/etc first
        card.x = slotOrigin.x + offset * Layout.PLAYER_HAND_OFFSET;
        card.y = slotOrigin.y;
        offset++;
    });

}


function initializeCompanion(card) {
    let companionInfo = {
        card: card,
        maxHealth: MAX_HEALTH,
        currentHealth: MAX_HEALTH,
        isRingBearer: false
    }
    if (card.cardType === "RingBearer") {
        companionInfo.isRingBearer = true;
    }

    console.log("Initializing companion: %s", JSON.stringify(card, 2, null));
    // it is a map, so the location of the card does not matter.
    gameState.activeCompanions[card.uuid] = companionInfo;
}

function slotHasCompanion(slot) {
    for (let i = 0; i < slot.length; i++) {
        if (cardIsCompanionType(slot[i])) {
            return true;
        }
    }
    return false;
}
function placeCardInCompanionSlot(from, card, slotNum) {
    let companionSlot = gameState.companionSlots[slotNum];
    let companionSlotOccupied = slotHasCompanion(companionSlot);
    let cardIsCompanion = cardIsCompanionType(card);

    console.log("Placing card : %s in companion slot: %d", JSON.stringify(card, 2, null), slotNum);

    if (companionSlotOccupied == false) {
        if (cardIsCompanion == false) {
            console.error("Cannot place non-companion in companion slot first");
            return false;
        }
        initializeCompanion(card);
    } else if (companionSlotOccupied) {
        if (cardIsCompanion) {
            console.error("Companion already at slot %d", slotNum);
            return false;
        }
    }

    companionSlot.push(card);
    restackCompanionSlot(slotNum);

    sendCardMovedEvent(from, "playerCompanion", card, slotNum);
    return true;
}

function placeCardInCompanionPile(from, card) {
    let offset = uiState.mouseX - companionZone.x;
    let slotNum = Math.floor(offset / (companionZone.width / MAX_NUMBER_COMPANIONS));

    return placeCardInCompanionSlot(from, card, slotNum);
}

function placeCardInFreeCompanionSlot(from, card) {
    let i = 0;
    console.log("Placing card in a companion slot");
    for (i = 0; i < MAX_NUMBER_COMPANIONS; i++) {
        if (gameState.companionSlots[i].length == 0) {
            console.log("Found empty slot at %d", i);
            return placeCardInCompanionSlot(from, card, i);
        }
    }
    console.error("Could not play card in open companion slot");
    return false;
}

function playSiteFromDeck(siteNum) {
    for (let i = 0; i < gameState.cardsInSiteDeck.length; i++) {
        let card = gameState.cardsInSiteDeck[i];
        if (card.cardType == "Site" && card.siteNum == siteNum) {
            let siteCard = gameState.cardsInSiteDeck.splice(i, 1)[0];
            placeCardAtSite("playerDeck", siteCard, siteNum - 1);
            draw();
            return;
        }
    }
}

// Card moved from origin, figure out where it went.
function handleGenericCardMoved(from, selectedCard) {
    const dropZones = [
        { toArea: playerHand, action: placeCardInHand },
        { toArea: discardPile, action: placeCardInDiscard },
        { toArea: companionZone, action: placeCardInCompanionPile },
        { toArea: supportZone, action: placeCardInSupportPile },
        { toArea: deadPile, action: placeCardInDeadPile },
    ]

    for (const zone of dropZones) {
        if (mouseInArea(zone.toArea)) {
            if (zone.action(from, selectedCard)) {
                return;
            }
        }
    }

    if (handleSitePlacement(from, selectedCard)) {
        console.log("Site place handled, done with handleGenericMoved;")
    } else {
        placeCardOnPlayArea(from, selectedCard);
    }
}

function handleDiscardCardTapped() {
    if (uiState.discardPreviewActive) {
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





function handleGenericCardTapped(fromPile, pile) {
    const clickActions = {
        "playerHand": null,
        "playerDiscard": handleDiscardCardTapped,
    }
    if (clickActions[fromPile] != null) {
        console.log("Handling click action for pile:%s", fromPile);
        clickActions[fromPile]();
    }
}

function checkCardReleased(tapped, fromPile, pile) {
    for (let i = pile.length - 1; i >= 0; i--) {
        let card = pile[i];
        if (card === uiState.activelySelectedCard) {
            if (tapped) {
                console.log("Card tapped")
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

function handleSiteCardRelease() {
    for (let i = 0; i < gameState.cardsInSiteSlots.length; i++) {
        let card = gameState.cardsInSiteSlots[i];
        if (card && card === uiState.activelySelectedCard) {
            handleGenericCardMoved("site" + (i + 1), card);
            delete gameState.cardsInSiteSlots[i];
            uiState.activelySelectedCard = null;
            return true;
        }
    }
    return false;
}

// Cards from deck immediately go into player Hand.
function handleDrawDeckTapped() {
    // Ignore draw deck tap while companion preview is active.
    if (uiState.companionPreviewActive) {
        return;
    }
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
function removeCardFromDeck(card) {
    let offset = -1;
    console.log("Searching for %s ( %s ) ", card.uuid, card.id);
    for (let i = 0; i < gameState.cardsInDrawDeck.length; i++) {
        if (gameState.cardsInDrawDeck[i].uuid == card.uuid) {
            console.log("Found matching card ref :%s", card.uuid);
            offset = i;
            break;
        }
    }
    if (offset >= 0) {
        console.log("Removing %s (%s) from deck", card.uuid, card.id);
        let pulledCard = gameState.cardsInDrawDeck.splice(offset, 1)[0];
        console.log("removed : %s", pulledCard);
        return pulledCard;
    }
    return null;
}

function handleCompanionPreviewTapped() {
    if (uiState.companionPreviewActive == false) {
        return;
    }
    const numCompanionInPreview = uiState.companionPreviewCards.length;
    let i = 0;

    // Remove corresponding card from draw deck into companion slot.
    for (i = 0; i < numCompanionInPreview; i++) {
        if (isMouseOverCard(uiState.companionPreviewCards[i])) {
            break;
        }
    }
    if (i < numCompanionInPreview) {
        // Remove it from draw deck and UI preview.
        let card = uiState.companionPreviewCards[i];
        uiState.companionPreviewCards.splice(i, 1)[0];
        let pulledCard = removeCardFromDeck(card);
        if (pulledCard) {
            console.log("Pulled card from deck: %s", JSON.stringify(pulledCard, 2, null));
            placeCardInFreeCompanionSlot("playerDeck", pulledCard);
        } else {
            console.error("Could not find card in draw decK??");
        }
    }
}

function handleSiteSlotTapped() {
    for (let i = 0; i < siteSlots.length; i++) {
        if (isMouseOverCard(siteSlots[i])) {
            playSiteFromDeck(i + 1);
        }
    }
}

function handleCompanionCardsReleased(tapped) {
    let i = 0;
    gameState.companionSlots.forEach(slot => {
        checkCardReleased(tapped, ("playerCompanion" + i), slot);
        i++;
    });
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
    const cardReleaseDispatch = [
        { name: "playArea", pile: gameState.cardsInPlay },
        { name: "playerHand", pile: gameState.cardsInPlayerHand },
        { name: "playerDeadPile", pile: gameState.cardsInPlayerDeadPile },
        { name: "playerSupportArea", pile: gameState.cardsInSupportArea },
        { name: "playerDiscard", pile: gameState.cardsInPlayerDiscard },
    ]

    for (let dispatch of cardReleaseDispatch) {
        if (checkCardReleased(tapped, dispatch.name, dispatch.pile)) {
            console.log("Card event handled for pile : %s", dispatch.name);
            break;
        }
    }
    handleSiteCardRelease(tapped);
    handleCompanionCardsReleased(tapped);

    if (tapped) {
        handleCompanionPreviewTapped();
        handleDrawDeckTapped();
        handleSiteSlotTapped();

    }
    uiState.activelySelectedCard = null; // backstop
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

function mouseInArea(area) {
    return uiState.mouseX >= area.x && uiState.mouseX <= area.x + area.width &&
        uiState.mouseY >= area.y && uiState.mouseY <= area.y + area.height;
}

// Handle mouse down event to start dragging a card
canvas.addEventListener('mousedown', (e) => {
    uiState.mouseX = e.offsetX / canvas.width;
    uiState.mouseY = e.offsetY / canvas.height;
    uiState.startX = uiState.mouseX
    uiState.startY = uiState.mouseY

    // Search decks that have "draggable" cards.
    const cardPiles = [
        { cards: gameState.cardsInPlayerHand, vertical: true },
        { cards: gameState.cardsInPlayerDiscard, vertical: true },
        { cards: gameState.cardsInPlay, vertical: true },
        { cards: gameState.cardsInSupportArea, vertical: true },
        { cards: gameState.cardsInSiteSlots, vertical: false },
        { cards: gameState.cardsInPlayerDeadPile, vertical: false }
    ]
    // Check companion cards + possesions
    gameState.companionSlots.forEach(slot => { cardPiles.push({ cards: slot, vertical: true }); });

    // Check every pile of playerCards to see if a card was selected.
    let k = 0;
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

// Handle mouse move event to drag the card
canvas.addEventListener('mousemove', (e) => {
    uiState.mouseX = e.offsetX / canvas.width;
    uiState.mouseY = e.offsetY / canvas.height;
    // Draw drag movement.
    if (uiState.activelySelectedCard) {
        handleCardDragged()
    }

    draw();
});

function playRingBearerFromDeck() {
    let bearer = null;
    let ring = null;
    let bearerIdx = -1;
    let ringIdx = -1;

    for (let i = 0; i < gameState.cardsInDrawDeck.length; i++) {
        let card = gameState.cardsInDrawDeck[i];
        if (card.cardType == "RingBearer") {
            bearer = card;
            bearerIdx = i;
        } else if (card.cardType == "Ring") {
            ring = card;
            ringIdx = i;
        }
    }

    if (ring && bearer) {
        removeCardFromDeck(ring);
        removeCardFromDeck(bearer);
        placeCardInCompanionSlot("playerDeck", bearer, 0);
        placeCardInCompanionSlot("playerDeck", ring, 0);
    } else {
        console.error("Failed to play Ring and Bearer from player deck");
    }
}

//
// Handle opponent card moves
//
function findCardFromOtherSite(eventData) {
    for (let i = 0; i < gameState.cardsInOpponentSite.length; i++) {
        let existingCard = gameState.cardsInOpponentSite[i];
        if (existingCard && existingCard.uuid === eventData.cardUuid) {
            console.log("Found card at existing site");
            delete gameState.cardsInOpponentSite[i];
            return existingCard;
        }
    };
}

function findCardFromCompanionPiles(eventData) {
    for (let j = 0; j < MAX_NUMBER_COMPANIONS; j++) {
        let companionSlot = gameState.cardsInOpponentCompanionSlots[j];
        for (let i = 0; i < companionSlot.length; i++) {
            let existingCard = companionSlot[i];
            if (existingCard && existingCard.uuid === eventData.cardUuid) {
                console.log("Found card at existing companion slot");
                delete companionSlot[i];
                return existingCard;
            }
        }
    }
}


// Ideally the player _knows_ what pile the card must have come from (e.g. can have "fromPile")
// But this _should_ help synchronization anyway.
function findCardFromExistingPile(eventData) {
    let fromPileName = eventData.fromPile;
    const pileSearch = {
        "playArea": gameState.cardsInOpponentPlay,
        "playerHand": gameState.cardsInOpponentsHand,
        "playerDiscard": gameState.cardsInOpponentsDiscard,
        "playerDeadPile": gameState.cardsInOpponentDeadPile,
        "playerDeck": gameState.cardsInOpponentDrawDeck,
        "playerSupportArea": gameState.cardsInOpponentSupportArea,
    }

    let pile = pileSearch[fromPileName]
    if (!pile) {
        if (fromPileName.includes("site")) {
            console.log("FromPile is a site, finding card from another site.")
            return findCardFromOtherSite(eventData);
        } else if (fromPileName.includes("playerCompanion")) {
            console.log("From pile is a companion pile");
            return findCardFromCompanionPiles(eventData);
        } else {
            console.log("Invalid pile to search");
        }
    }
    if (pile) {
        console.log("Finding card from :%s", fromPileName);
        let card = pile.find(card => card && (card.uuid === eventData.cardUuid));
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
        console.log("Moving existing card (%d)", existingCard.uuid)
        existingCard.x = eventData.position.x;
        existingCard.y = eventData.position.y;
        toPile.push(existingCard);
    } else {
        console.log("New card played, going to : %s pile", toPile)

        let card = initCard(eventData.cardId);
        card.uuid = eventData.cardUuid; // override uuid generated ref.
        card.x = eventData.position.x;
        card.y = eventData.position.y;
        toPile.push(card);
    }
    // Push to top of stack.
}

function handleRemotePlayAreaCard(eventData) {
    // Since these are "free form cards", we actually want to play them
    // in relation to the opponent, so mirror the Y  equator using the y-midpoint
    // of the card
    let y_mid = eventData.position.y + CARD_HEIGHT;
    eventData.position.y = (1.0 - y_mid);
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

function handleRemotePlayerCompanionArea(eventData) {
    console.log("Handling event to opponent companion area : toPile:Companion[%d]", eventData.index)
    commonRemoteCardAction(eventData, gameState.cardsInOpponentCompanionSlots[eventData.index])
}

function handleRemotePlayerSupportArea(eventData) {
    commonRemoteCardAction(eventData, gameState.cardsInOpponentSupportArea)
}

function handleRemotePlayerSite(eventData) {
    const siteNumIdx = eventData.index;

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
        console.log("Moving existing  card(%d)", existingCard.uuid)
        existingCard.x = siteSlots[siteNumIdx].x
        existingCard.y = siteSlots[siteNumIdx].y
        gameState.cardsInOpponentSite[siteNumIdx] = existingCard;
    } else {
        console.log("New card played")
        let card = initCard(eventData.cardId);
        card.uuid = eventData.cardUuid; // override uuid generated ref.
        card.x = siteSlots[siteNumIdx].x;
        card.y = siteSlots[siteNumIdx].y
        gameState.cardsInOpponentSite[siteNumIdx] = card;
    }
}

function moveStackToDrawDeck(stack) {
    while (stack.length > 0) {
        let card = stack.pop();
        if (card) {
            card.x = drawDeck.x;
            card.y = drawDeck.y;
            gameState.cardsInDrawDeck.push(card);
        }
    }
}
function handleGatherAndShuffleCards() {
    moveStackToDrawDeck(gameState.cardsInPlay)
    moveStackToDrawDeck(gameState.cardsInPlayerHand)
    moveStackToDrawDeck(gameState.cardsInPlayerDiscard)
    moveStackToDrawDeck(gameState.cardsInPlayerDeadPile)
    moveStackToDrawDeck(gameState.cardsInSupportArea);
    gameState.companionSlots.forEach(slotPile => { moveStackToDrawDeck(slotPile) });
    moveStackToDrawDeck(gameState.cardsInSiteSlots);
}

document.getElementById("gatherButton").addEventListener("click", () => {
    handleGatherAndShuffleCards();
    draw();
});

document.getElementById("")
function changeCounter(delta) {
    count += delta;
    document.getElementById("counter").textContent = count;
}

function toggleCompanionPreview() {
    if (uiState.companionPreviewActive == false) {
        uiState.companionPreviewActive = true;

        uiState.companionPreviewCards = [];
        gameState.cardsInDrawDeck.forEach(card => {
            if (card.cardType === "Companion") {
                // Unique only.
                uiState.companionPreviewCards.push(card);
            }
        });
    } else {
        uiState.companionPreviewActive = false;
        uiState.companionPreviewCards.forEach(card => {
            card.x = Layout.drawDeck.y;
            card.y = Layout.drawDeck.y;
        })
    }
}

function resetDiscardPreview() {
    gameState.cardsInPlayerDiscard.forEach(card => {
        card.x = discardPile.x;
        card.y = discardPile.y;
    });
}

function toggleDiscardPreview() {
    if (uiState.discardPreviewActive) {
        uiState.discardPreviewActive = false;
        resetDiscardPreview();
    } else {
        uiState.discardPreviewActive = true;
    }
}

document.getElementById("companionsButton").addEventListener("click", () => {
    toggleCompanionPreview();
    draw();
});

document.getElementById("discardPileButton").addEventListener("click", () => {
    toggleDiscardPreview();
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
    gameState.cardsInOpponentSupportArea = [];
    for (let i = 0; i < MAX_NUMBER_COMPANIONS; i++) {
        gameState.cardsInOpponentCompanionSlots[i] = []
    }

    // Probably _not_ the best place to send this event, likely want a SM.
    sendDeckInitialized(gameState.cardsInDrawDeck.length);

    draw();
});

document.addEventListener('remoteCardEvent', (msg) => {
    console.log("Received a remote card Event : {}", msg.detail);
    const eventData = msg.detail;

    const cardEventDispatch = {
        "playArea": handleRemotePlayAreaCard,
        "playerHand": handleRemotePlayerHand,
        "playerDiscard": handleRemotePlayerDiscard,
        "playerDeadPile": handleRemotePlayerDeadPile,
        "playerCompanion": handleRemotePlayerCompanionArea,
        "playerSupportArea": handleRemotePlayerSupportArea
    }
    if (cardEventDispatch[eventData.toPile]) {
        cardEventDispatch[eventData.toPile](eventData);
    } else if (eventData.toPile.includes("site")) {
        handleRemotePlayerSite(eventData);
    }
    draw();
});

function handleOpponentDeckLoaded(eventData) {
    // probably a better way to do this.
    console.log("Lazily initializing opponent draw deck")
    let placeHolder = initCard("LOTR-0000");
    placeHolder.uuid = 0;
    for (let i = 0; i < eventData.deckSize; i++) {
        gameState.cardsInOpponentDrawDeck.push(placeHolder);
    }
}

function handleTwilightChanged(eventData) {
    document.getElementById("twlightCounter").textContent = parseInt(eventData.twilight);
}

function initGame() {
    if (gameState.playerInitialized == false) {
        playRingBearerFromDeck();
        gameState.playerInitialized = true;
    }
}

document.addEventListener('remoteGameEvent', (msg) => {
    // HACK to ensure player game is initialized before handling events
    initGame();

    console.log("received a remote game event : %s", JSON.stringify(msg.detail, null, 2));
    const eventData = msg.detail;

    switch (eventData.type) {
        case GAME_EVENT_DECK_INIT:
            handleOpponentDeckLoaded(eventData);
            break;
        case GAME_EVENT_TWILIGHT_CHANGED:
            handleTwilightChanged(eventData);
            break;
        default:
            console.error("Unhandled gameEvent: %s", eventData.type)
            break;

    }

    draw();
})


document.addEventListener('gameStarted', (msg) => {
    console.log("Game has officially started")
    // Right spot?
    initGame();
})

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerWidth / aspectRatio;
    draw();
}
window.addEventListener('resize', resizeCanvas);

// Initial draw
draw();
