import { initializePlayerDeck } from "./decks.js";
import * as Notification from "./notification.js";
import * as Layout from "./canvas_layout.js"


const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// game event enums.
const GAME_EVENT_DECK_INIT = "deckInitialized";
const GAME_EVENT_TWILIGHT_CHANGED = "twilightChanged";
const GAME_EVENT_CHARACTER_INFO_CHANGED = "characterInfoChanged";
const GAME_EVENT_PLAYER_MOVED = "playerMoved";
const GAME_EVENT_BURDENS_BID = "burdensBid";

const GAME_STATE_INIT = "Init";
const GAME_STATE_BID_BURDENS = "BidBurdens";
const GAME_STATE_AWAIT_OPPONENT_BID = "AwaitOpponentBid";
const GAME_STATE_FELLOWSHIP = "Fellowship";
const GAME_STATE_SHADOW = "Shadow";
const GAME_STATE_MANUEVER = "Manuever";
const GAME_STATE_ARCHERY = "Archery";
const GAME_STATE_ASSIGNMENT = "Assignment";
const GAME_STATE_SKIRMISH = "Skirmish";
const GAME_STATE_REGROUP = "Regroup";


const UNKNOWN_PLAYER = -1;
const OPPONENT = 0;
const PLAYER = 1;



// UI constants
const DRAG_THRESHOLD = 0.015;

// UI Globals
let logical = { width: canvas.width, height: canvas.height };

// Define  "snap area" (a target area where cards should snap when dropped)
// Game constants
const MAX_CARDS_IN_HAND = 11;
const MAX_NUMBER_COMPANIONS = 9;
const MAX_HEALTH = 4;
const MAX_BURDENS = 9;

// Card object structure, top of cards is "top of stack"
const siteButtonLeft = {
    x: Layout.siteControlArea.x, y: Layout.siteControlArea.y + Layout.siteButtonOffset,
    width: Layout.buttonWidth, height: Layout.buttonHeight, label: "siteLeft",
    callback: () => {
        moveToNextSite(-1);
    }
}

const siteButtonRight = {
    x: Layout.siteControlArea.x + (Layout.siteControlArea.width - Layout.buttonWidth),
    y: Layout.siteControlArea.y + Layout.siteButtonOffset,
    width: Layout.buttonWidth, height: Layout.buttonHeight, label: "siteRight",
    callback: () => {
        moveToNextSite(1);
    }
}

const burdenBidLeft = {
    x: Layout.burdenBidArea.x, y: Layout.burdenBidArea.y,
    width: Layout.burdenBidArea.width / 3, height: Layout.burdenBidArea.height, label: "burdenBidLeft",
    callback: () => {
        gameState.player.burdensBid = Math.max(0, gameState.player.burdensBid - 1);
    }
}

const burdenBidRight = {
    x: Layout.burdenBidArea.x + Layout.burdenBidArea.width * (2 / 3),
    y: Layout.burdenBidArea.y,
    width: Layout.burdenBidArea.width / 3, height: Layout.burdenBidArea.height, label: "burdenBidRight",
    callback: () => {
        gameState.player.burdensBid = Math.min(8, gameState.player.burdensBid + 1);
    }
}

const moveAgainButton = {
    x: Layout.burdenBidArea.x + Layout.burdenBidArea.width * (1 / 2),
    y: Layout.burdenBidArea.y,
    width: Layout.burdenBidArea.width / 2, height: Layout.burdenBidArea.height, label: "moveAgain",
    callback: () => {
        gameStateMachine(GAME_STATE_EVENT_MOVE_AGAIN);
    }
}
const endTurnButton = {
    x: Layout.burdenBidArea.x, y: Layout.burdenBidArea.y,
    y: Layout.burdenBidArea.y,
    width: Layout.burdenBidArea.width / 2, height: Layout.burdenBidArea.height, label: "endTurn",
    callback: () => {
        gameStateMachine(GAME_STATE_EVENT_END_TURN);
    }
}


const burdenBidSubmitButton = {
    x: Layout.burdenBidArea.x + Layout.burdenBidArea.width * 0.5 - Layout.buttonWidth / 2,
    y: Layout.burdenBidArea.y + Layout.burdenBidArea.height,
    width: Layout.buttonWidth, height: Layout.buttonHeight, label: "burdenBidSubmit",
    callback: () => {
        gameStateMachine(GAME_STATE_EVENT_BURDENS_BID);
    }
}


const gameStatePrevButton = {
    x: Layout.gameStateArea.x + Layout.gameStateArea.width * (1 / 6) - Layout.ARROW_WIDTH / 2, y: Layout.gameStateArea.y,
    width: Layout.ARROW_WIDTH, height: Layout.ARROW_HEIGHT, label: "gameStatePrev",
    callback: () => {
        alert("GEMP Rules, suck it, no take-backsies");
    }
}

const gameStateNextButton = {
    x: Layout.gameStateArea.x + Layout.gameStateArea.width * (5 / 6) - Layout.ARROW_WIDTH / 2, y: Layout.gameStateArea.y,
    width: Layout.ARROW_WIDTH, height: Layout.ARROW_HEIGHT, label: "gameStateNext",
    callback: () => {
        console.log("GameState next called");
        gameStateMachine(GAME_STATE_EVENT_PHASE_FINISHED);
    }
}

// Dynamic state of the UI based on button presses/movements/etc.
const uiState = {
    mouseX: 0.0,
    mouseY: 0.0,
    startX: 0.0,
    startY: 0.0,

    activelySelectedCard: null,
    discardPreviewActive: false,

    companionPreviewActive: false,
    companionPreviewCards: null,

    burdenBidPreviewActive: false,
    waitingOpponentBidPreviewActive: false,
    moveAgainPreviewActive: false,

    drawDeckPreviewActive: false,
    drawDeckPreviewCards: [],

    cardToPreview: null,
    siteButtons: [siteButtonLeft, siteButtonRight],
    burdenBidButtons: [burdenBidLeft, burdenBidRight],
    burdenBidSubmitButton: burdenBidSubmitButton,
    gameStateButtons: [gameStatePrevButton, gameStateNextButton],
    regroupButtons: [moveAgainButton, endTurnButton],
    /*Animation  Info*/
    animationCards: []
}
uiState.companionPreviewCards = new Map();




let gameState = {
    gameId: "",
    twilight: 0,
    turn: 0,
    currentState: GAME_STATE_INIT,
    activeFellowship: UNKNOWN_PLAYER,
    player: {
        initialized: false,
        name: "",
        token: null,
        currentSite: 1,
        companions: {},
        minions: {},
        allies: {}, // TODO.
        burdensBid: -1,

    },
    opponent: {
        initialized: false,
        token: null,
        name: "",
        currentSite: 1,
        companions: {},
        minions: {},
        allies: {},
        burdensBid: -1,

    },

    cardsInPlay: [],
    cardsInPlayerHand: [],
    cardsInPlayerDiscard: [],
    cardsInPlayerDeadPile: [],
    cardsInDrawDeck: [],
    cardsInSiteDeck: [],
    cardsInSupportArea: [],
    cardsInCompanionSlots: [],

    cardsInOpponentPlay: [],
    cardsInOpponentsHand: [],
    cardsInOpponentsDiscard: [],
    cardsInOpponentDeadPile: [],
    cardsInOpponentDrawDeck: [],
    cardsInOpponentSupportArea: [],
    cardsInOpponentCompanionSlots: [],

    cardsInOpponentSite: [],
    cardsInSiteSlots: [],
    globalUuidRef: 0,
}

function initCompanionSlots() {
    for (let i = 0; i < MAX_NUMBER_COMPANIONS; i++) {
        gameState.cardsInCompanionSlots[i] = []
        gameState.cardsInOpponentCompanionSlots[i] = []
    }
}
initCompanionSlots();


function initCard(_id, cardType, siteNum = 0) {
    gameState.globalUuidRef++;

    return {
        id: _id, /* This is the refrence picture/name of card. May be multiple instances in deck/game */
        uuid: gameState.globalUuidRef, /* unique identifier for this players instance of _id, unique per game */
        x: Layout.drawDeck.x, /* The current location of the card, may be in pile or on board*/
        y: Layout.drawDeck.y, /* ** */
        z: 0, /* unsued atm */
        width: Layout.CARD_WIDTH, /* Generally static unless a preview is made */
        height: Layout.CARD_HEIGHT, /* */
        cardType: cardType, /* Meta data about cardType (Companion/site/ring/condtion/etc),
                    may set condtions on where it can be played */
        siteNum: siteNum,
        /* Animation of card objects */
        animation: {
            active: false,
            targetX: Layout.drawDeck.x,
            targetY: Layout.drawDeck.y,
            duration: 600, // At 60fps, 300 ~ 5s. 
            startTime: null
        }

    }
}

function animateCardTo(card, position) {
    card.animation.targetX = position.x;
    card.animation.targetY = position.y;
    card.animation.startTime = performance.now();
    card.animation.active = true;

    uiState.animationCards.push(card);
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

    const img = new Image(Layout.CARD_WIDTH, Layout.CARD_HEIGHT);
    img.src = `assets/cards/${cardId}.png`;
    cardLibrary[cardId] = img;
    return img;
}

const assetLibrary = {}

function getAsset(asset) {
    if (assetLibrary[asset]) {
        return assetLibrary[asset];
    }
    const img = new Image();
    img.src = `assets/${asset}.png`
    assetLibrary[asset] = img;
    return img;
}

function sendGameEvent(event) {
    // console.debug("Dispatching gameEvent: %s", JSON.stringify(event, null, 2))
    document.dispatchEvent(new CustomEvent("gameEvent", { detail: event }));
}

function sendCharacterEvent(characterInfo) {
    let woundEvent = {
        type: GAME_EVENT_CHARACTER_INFO_CHANGED,
        character: characterInfo.card.uuid,
        wounds: characterInfo.currentWounds,
        burdens: characterInfo.currentBurdens,
        strengthModifier: characterInfo.strengthModifier
    }
    sendGameEvent(woundEvent);
}

function sendDeckInitialized(deckSize) {
    let deckLoadedEvent = {
        type: GAME_EVENT_DECK_INIT,
        deckSize: deckSize,
        token: gameState.player.token
    }
    sendGameEvent(deckLoadedEvent)
}

function sendTwilightChangedEvent(twilight) {
    let twilightChangedEvent = {
        type: GAME_EVENT_TWILIGHT_CHANGED,
        twilight: twilight,
    }
    sendGameEvent(twilightChangedEvent);
}

function sendPlayerMovedEvent(site) {
    let playerMovedEvent = {
        type: GAME_EVENT_PLAYER_MOVED,
        site: site,
    }
    sendGameEvent(playerMovedEvent);
}

function sendBurdenBidEvent(burdens) {
    let burdensBidEvent = {
        type: GAME_EVENT_BURDENS_BID,
        burdens: burdens
    }
    sendGameEvent(burdensBidEvent);
}

function sendPhaseFinishedEvent(newState) {
    let phaseFinishedEvent = {
        type: GAME_STATE_EVENT_PHASE_FINISHED,
        currentState: newState
    }
    sendGameEvent(phaseFinishedEvent);
}

function sendEndTurnEvent(newState) {
    let endTurnEvent = {
        type: GAME_STATE_EVENT_END_TURN,
        currentState: newState
    }
    sendGameEvent(endTurnEvent)
}

function getTokenFromDeckName(deckName) {
    if (deckName == "Aragorn") {
        return "aragorn_pipe_token";
    } else if (deckName == "Gandalf") {
        return "gandalf_pipe_token"
    } else if (deckName == "Gimli") {
        return "gimli_council_token";
    }
}

async function initCardDeck(gameId) {
    // Load from starter deck.
    // E.g. csv.lines.forEach({cardsInDrawDeck.push(initCard(line))})
    gameState.player.name = sessionStorage.getItem("playerName")
    gameState.gameId = sessionStorage.getItem("gameID");
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
        // Pre-cache all card assets here.
        // getCardImage(cardObj.cardId);
    })
    gameState.player.token = getTokenFromDeckName(gameState.deck)

    sendDeckInitialized(initialDeck.length);
}

function saveGame(gameState) {
    console.log("Saving game : %s", gameState.gameId)
    const key = `gameState_${gameState.gameId}`
    localStorage.setItem(key, JSON.stringify(gameState));
}


function loadGame() {
    let savedState = null;
    let gameId = sessionStorage.getItem("gameID")
    const key = `gameState_${gameId}`
    const savedStateData = localStorage.getItem(key);

    if (savedStateData) {
        savedState = JSON.parse(savedStateData)
        console.log("Previous game available: %s", savedStateData);
        // reattach button handlers for items.
        Object.entries(savedState.player.companions).forEach(([id, companion]) => {
            initializeCompanion(companion.card, companion.homeSlot);
        });
        Object.entries(savedState.player.minions).forEach(([id, minion]) => {
            initializeMinion(minion.card);
        });
    }
    return savedState ? savedState : null;
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
function drawText(text, x, y, centered = true, fontFillStyle = 'black', baseFontSize = 8.0) {
    const scale = logical.width / 800;
    const scaledFontSize = Math.round(baseFontSize * scale);

    //ctx.font = `${scaledFontSize}px "Uncial Antiqua", serif`; // Set font size and type
    ctx.font = `${scaledFontSize}px "Uncial Antiqua"`;
    ctx.fillStyle = fontFillStyle; // Set text color
    if (centered) {
        const textWidth = ctx.measureText(text).width;
        x = x - textWidth / 2;
    }
    ctx.fillText(text, x, y); // Draw the text at position (50, 150)
}


function drawRectR(area, text = "", fillStyle = 'rgba(255, 255, 255, 0.3', fontFillStyle = 'black') {
    let x = Math.round(area.x * logical.width);
    let y = Math.round(area.y * logical.height);
    let width = Math.round(area.width * logical.width);
    let height = Math.round(area.height * logical.height);


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

    drawText(text, x + width / 2, y + height / 2, true, fontFillStyle)
}

function drawRect(area, text = "", fillStyle = 'rgba(255, 255, 255, 0.5', fontFillStyle = 'black') {
    let x = Math.round(area.x * logical.width);
    let y = Math.round(area.y * logical.height);
    let width = Math.round(area.width * logical.width);
    let height = Math.round(area.height * logical.height);

    ctx.save();
    ctx.fillStyle = fillStyle;
    ctx.fillRect(x, y, width, height);

    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1;
    ctx.rect(x, y, width, height, 15);
    ctx.stroke();

    drawText(text, x + width / 2, y + height / 2, true, fontFillStyle);
    ctx.restore();
}

function drawGradientRect(area, text) {
    // percentage adjusted.
    let x = Math.round(area.x * logical.width);
    let y = Math.round(area.y * logical.height);
    let width = Math.round(area.width * logical.width);
    let height = Math.round(area.height * logical.height);

    const grad = ctx.createLinearGradient(0, 0, width, 0);
    grad.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
    grad.addColorStop(1, 'rgba(255, 255, 255, 0.5)');

    ctx.fillStyle = grad;
    ctx.fillRect(x, y, width, height);

    ctx.strokeStyle = '#000';
    ctx.strokeRect(x, y, width, height);

    drawText(text, x + width / 2, y + height / 2);
}



function drawBurdenBidPopup() {
    drawRect(Layout.burdenBidPopupArea, "", 'rgba(0, 0, 0, 0.5)', 'white')

    const x = Layout.burdenBidArea.x * logical.width;
    const y = Layout.burdenBidArea.y * logical.height;
    const w = Layout.burdenBidArea.width * logical.width;
    const h = Layout.burdenBidArea.height * logical.height;

    drawText("Bid Burdens", x + w / 2, y - h / 3, true, 'white', 16.0)

    const selectorImage = getAsset("SiteSelector");
    if (selectorImage) {
        if (selectorImage.complete) {   // Make sure the image is loaded
            ctx.save()
            ctx.drawImage(selectorImage, x, y, w, h);
            ctx.restore();
        }
    }

    drawText(gameState.player.burdensBid, x + w / 2, y + h / 2, true, 'white', 16.0);

    drawButton(uiState.burdenBidSubmitButton, "heal_button");
}

function drawWaitingBidPopup() {
    drawRect(Layout.burdenBidPopupArea, "", 'rgba(0, 0, 0, 0.5)', 'white')

    const x = Layout.burdenBidArea.x * logical.width;
    const y = Layout.burdenBidArea.y * logical.height;
    const w = Layout.burdenBidArea.width * logical.width;
    const h = Layout.burdenBidArea.height * logical.height;

    drawText("Waiting for Opponent", x + w / 2, y, true, 'white', 12.0);
}


function drawMoveAgainPopup() {
    drawRect(Layout.burdenBidPopupArea, "", 'rgba(0, 0, 0, 0.5)', 'white')

    const x = Layout.burdenBidArea.x * logical.width;
    const y = Layout.burdenBidArea.y * logical.height;
    const w = Layout.burdenBidArea.width * logical.width;
    const h = Layout.burdenBidArea.height * logical.height;

    drawText("Move Again ?", x + w / 2, y - h / 3, true, 'white', 16.0)

    drawRectR(moveAgainButton, "Move", 'rgba(192, 160, 0, 0.69)', 'rgb(255,255,255)');
    drawRectR(endTurnButton, "End Turn", 'rgba(192, 160, 0, 0.69)', 'rgb(255,255,255)');
}

// Card drawing primitives.c

// Draw the actual card based on its position/motion/animation info.
function drawCard(card, shadowColor = null) {
    let x = card.x * logical.width;
    let y = card.y * logical.height;
    let w = card.width * logical.width;
    let h = card.height * logical.height;


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
        cardImage.onload = () => {
            ctx.drawImage(cardImage, x, y, w, h);
        };
    }
}

function drawCardRotated(card, angle, shadowColor = null) {
    const cardImage = getCardImage(card.id);
    const x = card.x * logical.width;
    const y = card.y * logical.height;
    const w = card.width * logical.width;
    const h = card.height * logical.height;
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
    const x = card.x * logical.width;
    const y = card.y * logical.height;
    const w = card.width * logical.width;
    const h = card.height * logical.height;;

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
    cardPreview.width *= Layout.CARD_PREVIEW_SCALE_FACTOR;
    cardPreview.height *= Layout.CARD_PREVIEW_SCALE_FACTOR;
    if (drawUnder) {
        cardPreview.y = card.y + card.height + Layout.Margin
    } else {
        cardPreview.y = cardPreview.y - cardPreview.height - Layout.Margin;
    }
    drawCard(cardPreview)
}

function drawCardPreviewRotated(card, shadowColor = null) {
    let cardPreview = { ...card };
    cardPreview.width *= Layout.CARD_PREVIEW_SCALE_FACTOR;
    cardPreview.height *= Layout.CARD_PREVIEW_SCALE_FACTOR;
    cardPreview.x = cardPreview.x + Layout.CARD_WIDTH;

    const angle = 90;
    const cardImage = getCardImage(card.id);
    const x = cardPreview.x * logical.width;
    const y = cardPreview.y * logical.height;
    const w = cardPreview.width * logical.width;
    const h = cardPreview.height * logical.height;

    if (!cardImage || cardImage.complete === false) {
        return;
    }

    ctx.save();
    ctx.fillStyle = 'rgba(0, 0, 0, 1.0)';
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

function drawCardWithPreview(card, shadowColor = null) {
    let hover = isMouseOverCard(card);
    if (hover) {
        let offsetCard = { ...card }
        // Do not shift card if it is currently grabbed.
        if (uiState.activelySelectedCard == null) {
            // offsetCard.y = card.y - Layout.CARD_PREVIEW_SHIFT;
        }
        drawCard(offsetCard, shadowColor)
        uiState.cardToPreview = offsetCard;
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


function drawSiteSelectionButton() {
    const x = Layout.siteControlArea.x * logical.width;
    const y = Layout.siteControlArea.y * logical.height;
    const w = Layout.siteControlArea.width * logical.width;
    const h = Layout.siteControlArea.height * logical.height;

    // 1335:613
    const selectorImage = getAsset("SiteSelector");
    if (selectorImage) {
        if (selectorImage.complete) {   // Make sure the image is loaded
            ctx.save()
            ctx.drawImage(selectorImage, x, y, w, h);
            ctx.restore();
        }
    }
}

function drawSiteBorders() {
    let i = 0;
    Layout.siteSlots.forEach(siteSlot => {
        let siteName = "Site " + (i + 1);
        drawRectR(siteSlot, siteName);
        i++;
    })
    drawSiteSelectionButton();
}

function drawMinionCard(card) {

    drawCardWithPreview(card);
    if (gameState.player.minions[card.uuid]) {
        let actionPanel = gameState.player.minions[card.uuid].actionPanel;
        actionPanel.origin.x = card.x;
        actionPanel.origin.y = card.y;
        // drawVerticalActionPanel(actionPanel, gameState.player.minions[card.uuid])
        drawCharacterInfo(actionPanel, gameState.player.minions[card.uuid])
    }
}

// Player Card piles
// Draw all "loose leaf" cards on the table.
function drawInPlayCards() {
    // Draw the cards
    gameState.cardsInPlay.forEach(card => {
        if (gameState.player.minions[card.uuid]) {
            drawMinionCard(card);
        } else {
            drawCardWithPreview(card)
        }
    });
}

function drawCardImage(id, x, y, w, h, shadowColor = null) {
    const cardImage = getCardImage(id)
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
}

//
// Draw all the cards in a players hand, and if they are hovering over a card, an enlarged one.

function drawPlayerHand() {
    drawSpreadPile(gameState.cardsInPlayerHand);
}

function sf(num) {
    return Math.round(100 * num) / 100;
}

function drawFanoutHand() {
    let numCards = gameState.cardsInPlayerHand.length;

    // Define the circle segment on which to display cards
    const CIRCLE_ORIGIN = { x: 0.5, y: 1.3 }
    const CIRCLE_RADIUS = Layout.CARD_HEIGHT * canvas.height;
    // let radius = CIRCLE_RADIUS;
    let radius = 0.35 * canvas.height;
    const THETA_STEP = 6.0;
    const THETA0 = -THETA_STEP * (numCards / 2)

    for (let i = 0; i < numCards; i++) {
        let card = { ...gameState.cardsInPlayerHand[i] };
        const width = Math.round(card.width * logical.width);
        const height = Math.round(card.height * logical.height);

        // 
        let angle_deg = THETA0 + (i * THETA_STEP);
        const angle_rads = angle_deg * (Math.PI / 180); // Convert degrees to radian
        {
            card.x = CIRCLE_ORIGIN.x;
            card.y = CIRCLE_ORIGIN.y;
            ctx.save();
            // Set context to origin of card, and rotate it by THETA_RADS
            let x = (card.x + Layout.CARD_WIDTH / 2) * logical.width;
            let y = (card.y + Layout.CARD_HEIGHT / 2) * logical.height;
            ctx.translate(x, y);
            ctx.rotate(angle_rads);
            let nX = -width / 2;
            let nY = -height / 2 - radius;

            const cardImage = getCardImage(card.id);
            const w = card.width * logical.width;
            const h = card.height * logical.height;
            let isActiveCard = (card === uiState.activelySelectedCard);

            if (!cardImage || cardImage.complete === false) {
                return;
            }

            {
                ctx.save();
                ctx.fillStyle = isActiveCard ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 1.0)';
                let shadowColor = 'blue';
                if (shadowColor) {
                    ctx.shadowColor = shadowColor;
                    ctx.shadowBlur = 20;
                }
                ctx.drawImage(cardImage, nX, nY, w, h);
                ctx.restore();
            }
            ctx.restore();

        }
        // let info = "(" + sf(uiState.mouseX) + "," + sf(uiState.mouseY) + ")" + "a:" + sf(THETA_STEP) + " r:" + sf(radius);
        // drawCard(info, uiState.mouseX*logical.width, uiState.mouseY*logical.height);
    }

}

function drawPlayerSupportCards() {
    drawSpreadPile(gameState.cardsInSupportArea)
}


function drawToken(x, y, type, blurColor = 'rgb(0, 4, 255)') {
    x = x * logical.width;
    y = y * logical.height;
    let w = Layout.TOKEN_WIDTH * logical.width;
    let h = Layout.TOKEN_HEIGHT * logical.width;
    let radius = w / 2;

    ctx.save();
    ctx.beginPath();
    ctx.arc(x + radius, y + radius, radius, 0, Math.PI * 2);
    ctx.closePath();

    // Draw the border
    ctx.lineWidth = 2;
    ctx.strokeStyle = blurColor;
    ctx.stroke();

    ctx.shadowBlur = 20;
    ctx.shadowColor = blurColor;

    ctx.restore();
    // Draw the PNG image inside the card
    const tokenImage = getAsset(type);
    if (tokenImage) {
        if (tokenImage.complete) {   // Make sure the image is loaded
            ctx.save();
            ctx.drawImage(tokenImage, x, y, w, h);
            ctx.restore();
        }
    }

}

function drawButton(button, asset) {
    let x = button.x * logical.width;
    let y = button.y * logical.height;
    let height = button.height * logical.height;
    let width = button.width * logical.width;

    // width / height => 3/2.
    // (width ) /  = (height ) * (3/2) / aspectRatio.
    //width = height * (3 / 2);

    const buttonImage = getAsset(asset);
    ctx.drawImage(buttonImage, x, y, width, height);
}

function drawTextButton(button, asset, text) {
    let x = button.x * logical.width;
    let y = button.y * logical.height;
    let height = button.height * logical.height;
    let width = button.width * logical.width;

    // width / height => 3/2.
    // (width ) /  = (height ) * (3/2) / aspectRatio.
    //width = height * (3 / 2);

    const buttonImage = getAsset(asset);
    ctx.drawImage(buttonImage, x, y, width, height);

    drawText(text, x + width / 2, y + height / 2, true, 'white')
}

function drawDiamond(x, y, size, color) {
    x += size; // shift right
    x = x * logical.width;
    y = y * logical.height;
    size = size * logical.width;

    ctx.save();
    {
        ctx.beginPath();
        ctx.lineWidth = 2;
        ctx.moveTo(x, y - size); // Top point
        ctx.lineTo(x + size, y); // Right
        ctx.lineTo(x, y + size); // Bottom
        ctx.lineTo(x - size, y); // Left
        ctx.closePath();

        ctx.fillStyle = color;
        ctx.fill();

        ctx.strokeStyle = Layout.HEALTH_DIAMOND_BORDER_COLOR;
        ctx.stroke();
    }
    ctx.restore();
}

function drawHealthBar(origin, color, health, max = MAX_HEALTH) {
    let healthBar = {
        x: origin.x, y: origin.y,
        width: Layout.healthBarWidth, height: Layout.healthBarHeight
    };

    for (let i = 0; i < max; i++) {
        if (i >= health) {
            color = 'rgba(0,0,0,0.5)'
        }
        let x = healthBar.x + 2 * i * (Layout.HEALTH_DIAMOND_SIZE);
        let y = healthBar.y + Layout.HEALTH_DIAMOND_SIZE / 2;
        drawDiamond(x, y, Layout.HEALTH_DIAMOND_SIZE, color);
    }
}

function drawVerticalHealthBar(origin, color, health, max = MAX_HEALTH) {
    let healthBar = {
        x: origin.x, y: origin.y,
        width: Layout.healthBarWidth, height: Layout.healthBarHeight
    };

    for (let i = 0; i < max; i++) {
        let c = color;
        if (i < (max - health)) {
            c = 'rgba(0,0,0,0.5)'
        }

        let x = healthBar.x - Layout.HEALTH_DIAMOND_SIZE / 2;
        let y = healthBar.y + 3 * i * (Layout.HEALTH_DIAMOND_SIZE);
        drawDiamond(x, y, Layout.HEALTH_DIAMOND_SIZE, c);
    }
}

function drawVerticalActionPanel(actionPanel, companion) {
    const origin = { x: actionPanel.origin.x, y: actionPanel.origin.y }
    // Health Info
    actionPanel.heal.x = origin.x;
    actionPanel.heal.y = origin.y - Layout.buttonHeight;
    actionPanel.wound.x = origin.x + Layout.buttonWidth;
    actionPanel.wound.y = origin.y - Layout.buttonHeight;

    actionPanel.healthBar.x = origin.x - Layout.HEALTH_DIAMOND_SIZE;
    actionPanel.healthBar.y = origin.y;
    // Burden Info
    actionPanel.burdenBar.x = origin.x - Layout.HEALTH_DIAMOND_SIZE * 4;
    actionPanel.burdenBar.y = origin.y;

    // Strength Info.
    actionPanel.strength.x = origin.x + Layout.CARD_WIDTH + Layout.HEALTH_DIAMOND_SIZE;
    actionPanel.strength.y = origin.y + Layout.HEALTH_DIAMOND_SIZE;

    actionPanel.bolster.x = origin.x + Layout.CARD_WIDTH;
    actionPanel.bolster.y = origin.y - 4 * Layout.HEALTH_DIAMOND_SIZE;

    actionPanel.wounds.x = origin.x + Layout.CARD_WIDTH;
    actionPanel.wounds.y = origin.y + Layout.CARD_HEIGHT;

    const STR_CONTROL_SIZE = 0.02;
    actionPanel.bolster.width = STR_CONTROL_SIZE;
    actionPanel.bolster.height = STR_CONTROL_SIZE;
    actionPanel.wounds.width = STR_CONTROL_SIZE;
    actionPanel.wounds.height = STR_CONTROL_SIZE;

    drawButton(actionPanel.wound, "wound_button");
    drawButton(actionPanel.heal, "heal_button");
    drawButton(actionPanel.bolster, "bolster_power_button");
    drawButton(actionPanel.wounds, "weaken_power_button");

    drawVerticalHealthBar({ x: actionPanel.healthBar.x, y: actionPanel.healthBar.y },
        Layout.HEALTH_DIAMOND_COLOR, companion.currentWounds);
    if (companion.card.cardType == "RingBearer") {
        drawVerticalHealthBar({ x: actionPanel.burdenBar.x, y: actionPanel.burdenBar.y }
            , Layout.BURDEN_DIAMOND_COLOR, companion.currentBurdens, MAX_BURDENS)
    }

    let text = companion.strengthModifier;
    if (companion.strengthModifier >= 0) {
        text = "+" + text;
    }
    drawVerticalHealthBar({ x: actionPanel.strength.x, y: actionPanel.strength.y },
        'blue', companion.strengthModifier, MAX_BURDENS);

}


function drawActionRadial(radial, val, textColor = 'white', bgColor = 'rgba(100,100,100,0.8)') {
    let c = { x: radial.x, y: radial.y, r: radial.r }

    let x = c.x * logical.width;
    let y = c.y * logical.height;
    let r = c.r * logical.width;

    let color = 'white'

    ctx.save();
    ctx.beginPath(); // Start a new path
    ctx.arc(x, y, r, 0, 2 * Math.PI);
    ctx.strokeStyle = color; // Set stroke color
    ctx.lineWidth = 2; // Set line width
    ctx.stroke(); // Draw the path
    ctx.fillStyle = bgColor
    ctx.fill();
    ctx.closePath();

    ctx.beginPath();
    ctx.moveTo(x, y);      // Move to starting point (x1, y1)
    ctx.lineTo(x + r * Math.cos(Math.PI * (1 / 6)), y + r * Math.sin(Math.PI * (1 / 6)));    // Draw line to (x2, y2)
    ctx.strokeStyle = color; // Set line color
    ctx.stroke();
    ctx.closePath();

    ctx.beginPath();
    ctx.moveTo(x, y);      // Move to starting point (x1, y1)
    ctx.lineTo(x + r * Math.cos(Math.PI * (5 / 6)), y + r * Math.sin(Math.PI * (5 / 6)));    // Draw line to (x2, y2)
    ctx.strokeStyle = color; // Set line color
    ctx.stroke();
    ctx.closePath();

    ctx.beginPath();
    ctx.moveTo(x, y);      // Move to starting point (x1, y1)
    ctx.lineTo(x + r * Math.cos(Math.PI * (9 / 6)), y + r * Math.sin(Math.PI * (9 / 6)));    // Draw line to (x2, y2)
    ctx.strokeStyle = color; // Set line color
    ctx.stroke();
    ctx.closePath();

    let text = val;
    if (val >= 0) {
        text = "+" + text
    }
    let offset = 2 * r / 3;
    drawText(text, x, y + offset, true, textColor, 20);
    drawText("+", x + offset, y, true, textColor, 20);
    drawText("-", x - offset, y, true, textColor, 20);

    ctx.restore()
}


function drawCharacterInfo(actionPanel, companion) {
    let infoHeight = Layout.CARD_HEIGHT / 4;
    let rect = {
        x: actionPanel.origin.x, y: actionPanel.origin.y - infoHeight,
        width: Layout.CARD_WIDTH, height: infoHeight
    }

    actionPanel.wounds.x = rect.x;
    actionPanel.wounds.y = rect.y;
    actionPanel.wounds.width = rect.width / 3;
    actionPanel.wounds.height = rect.height;

    actionPanel.burdens.x = rect.x + rect.width * (1 / 3);
    actionPanel.burdens.y = rect.y
    actionPanel.burdens.width = rect.width / 3;
    actionPanel.burdens.height = rect.height;

    actionPanel.strength.x = rect.x + rect.width * (2 / 3);
    actionPanel.strength.y = rect.y
    actionPanel.strength.width = rect.width / 3;
    actionPanel.strength.height = rect.height;

    let text = companion.strengthModifier;
    if (companion.strengthModifier >= 0) {
        text = "+" + text;
    }
    drawHexagonText(actionPanel.strength, Layout.CARD_WIDTH / 3,
        'rgb(100, 100, 100)', text);
    if (actionPanel.strengthRadial.open) {
        actionPanel.strengthRadial.x = actionPanel.strength.x + actionPanel.strength.width / 2;
        actionPanel.strengthRadial.y = actionPanel.strength.y - 2 * actionPanel.strengthRadial.r;
        drawActionRadial(actionPanel.strengthRadial, companion.strengthModifier, 'white', 'rgb(100,100,100)');
    }

    drawHexagonText(actionPanel.wounds, Layout.CARD_WIDTH / 3,
        'red', companion.currentWounds);
    if (actionPanel.woundRadial.open) {
        actionPanel.woundRadial.x = actionPanel.wounds.x + actionPanel.wounds.width / 2;
        actionPanel.woundRadial.y = actionPanel.wounds.y - 2 * actionPanel.woundRadial.r;
        drawActionRadial(actionPanel.woundRadial, companion.currentWounds, 'white', 'red');
    }

    if (companion.card.cardType == "RingBearer") {
        drawHexagonText(actionPanel.burdens, Layout.CARD_WIDTH / 3,
            'white', companion.currentBurdens, 'black');
        if (actionPanel.burdenRadial.open) {
            console.log("Draw burden radial");
            actionPanel.burdenRadial.x = actionPanel.burdens.x + actionPanel.burdens.width / 2;
            actionPanel.burdenRadial.y = actionPanel.burdens.y - 2 * actionPanel.burdenRadial.r;
            drawActionRadial(actionPanel.burdenRadial, companion.currentBurdens, 'black', 'white');
        }
    }
}

function drawActionPanel(actionPanel, companion) {
    const origin = { x: actionPanel.origin.x, y: actionPanel.origin.y }
    // Health Info
    actionPanel.heal.x = origin.x;
    actionPanel.heal.y = origin.y - Layout.buttonHeight;
    actionPanel.wound.x = origin.x + Layout.buttonWidth;
    actionPanel.wound.y = origin.y - Layout.buttonHeight;
    actionPanel.healthBar.x = origin.x;
    actionPanel.healthBar.y = origin.y - Layout.buttonHeight - (Layout.healthBarHeight + Layout.Margin);
    // Burden Info
    actionPanel.burdenBar.x = origin.x;
    actionPanel.burdenBar.y = origin.y - Layout.buttonHeight - 2 * (Layout.healthBarHeight + Layout.Margin);

    // Strength Info.
    actionPanel.wounds.x = origin.x;
    actionPanel.wounds.y = actionPanel.burdenBar.y - Layout.buttonHeight;
    actionPanel.strength.x = actionPanel.wounds.x + actionPanel.wounds.width
    actionPanel.strength.y = actionPanel.bolster.y;
    actionPanel.bolster.x = actionPanel.strength.x + Layout.buttonWidth;
    actionPanel.bolster.y = actionPanel.wounds.y;

    drawButton(actionPanel.wound, "wound_button");
    drawButton(actionPanel.heal, "heal_button");
    drawButton(actionPanel.bolster, "bolster_power_button");
    drawButton(actionPanel.wounds, "weaken_power_button");

    drawHealthBar({ x: actionPanel.healthBar.x, y: actionPanel.healthBar.y },
        Layout.HEALTH_DIAMOND_COLOR, companion.currentWounds);
    if (companion.card.cardType == "RingBearer") {
        drawHealthBar({ x: actionPanel.burdenBar.x, y: actionPanel.burdenBar.y }
            , Layout.BURDEN_DIAMOND_COLOR, companion.currentBurdens, MAX_BURDENS)
    }

    let text = companion.strengthModifier;
    if (companion.strengthModifier >= 0) {
        text = "+" + text;
    }

    drawAsset(actionPanel.strength.x, actionPanel.strength.y,
        actionPanel.strength.width, actionPanel.strength.height, "bolster_button");
    drawRectR(actionPanel.strength, text, 'rgba(255, 200, 0, 0.00)', 'white');
}

function drawAsset(x, y, w, h, assetName) {
    x = x * logical.width;
    y = y * logical.height;
    w = w * logical.width;
    h = h * logical.height;

    const selectorImage = getAsset(assetName);
    if (selectorImage.complete) {   // Make sure the image is loaded
        ctx.save()
        ctx.drawImage(selectorImage, x, y, w, h);
        ctx.restore();
    }
}

function gameState2int(currentState) {
    switch (currentState) {
        case GAME_STATE_FELLOWSHIP:
            return 0;
        case GAME_STATE_SHADOW:
            return 1;
        case GAME_STATE_MANUEVER:
            return 2;
        case GAME_STATE_ARCHERY:
            return 3;
        case GAME_STATE_ASSIGNMENT:
            return 4;
        case GAME_STATE_SKIRMISH:
            return 5;
        case GAME_STATE_REGROUP:
            return 6;
        default:
            return -1;
    }
}

function drawGameState() {
    const NUM_GAME_STATES = 7;
    const OFFSET = Layout.opponentHand.width / NUM_GAME_STATES;
    const size = 0.01;
    let x = Layout.opponentHand.x + OFFSET / 2;
    let y = Layout.opponentHand.y / 2;

    drawRectR(Layout.gameStateArea, "", 'rgba(0,0,0,0.9)')
    drawRect({ x: Layout.gameStateArea.x, y: 0, width: 0.1, height: Layout.opponentHand.y },
        gameState.currentState, 'rgba(255,255,255,0.0)', 'rgb(255,255,255,1.0)');

    let i = 0;
    for (i = 0; i < NUM_GAME_STATES; i++) {
        let color = 'rgba(0,0,0,0)';
        if (i == gameState2int(gameState.currentState)) {
            color = Layout.HEALTH_DIAMOND_COLOR;
        }
        drawDiamond(x + i * OFFSET, y, size, color);
    }

    drawButton(gameStatePrevButton, "arrow_left");
    drawButton(gameStateNextButton, "arrow_right");
}



function drawCompanionActionPanels() {
    Object.entries(gameState.player.companions).forEach(([id, companion]) => {
        if (companion) {
            companion.actionPanel.origin.x = companion.card.x;
            companion.actionPanel.origin.y = companion.card.y;
            drawCharacterInfo(companion.actionPanel, companion);
        }
    })
}

function drawHexagonText(origin, width, fill = 'red', text = '', textFill = 'white') {

    const x = (origin.x + width / 2) * logical.width;
    const y = (origin.y + width / 2) * logical.height;
    const size = (width / 2) * logical.width;
    const angle = Math.PI / 3;

    ctx.save();
    ctx.beginPath();

    for (let i = 0; i < 6; i++) {
        const px = x + size * Math.cos(angle * i);
        const py = y + size * Math.sin(angle * i);
        ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.stroke();

    // Draw text
    ctx.fillStyle = textFill;
    ctx.font = 'bold 14px serif';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y + 5);
    ctx.restore();
}

function drawOpponentStrength(companion) {
    let origin = {
        x: companion.card.x + (2 / 3) * Layout.CARD_WIDTH,
        y: companion.card.y + Layout.CARD_HEIGHT + Layout.Margin
    }
    const str = companion.strengthModifier;
    let text = str;
    if (str >= 0) {
        text = "+" + text;
    }
    drawHexagonText(origin, Layout.CARD_WIDTH / 3, 'rgb(100,100,100)', text)
}

function drawOpponentHealth(companion) {
    let origin = { x: companion.card.x, y: companion.card.y + Layout.CARD_HEIGHT + Layout.Margin }
    // drawHealthBar(origin, Layout.HEALTH_DIAMOND_COLOR, companion.currentWounds);
    drawHexagonText(origin, Layout.CARD_WIDTH / 3, 'red', companion.currentWounds);

    if (companion.card.cardType == "RingBearer") {
        // origin.y = origin.y + (Layout.healthBarHeight + Layout.Margin);
        // drawHealthBar(origin, Layout.BURDEN_DIAMOND_COLOR, companion.currentBurdens, MAX_BURDENS);
        origin.x = origin.x + Layout.CARD_WIDTH / 3;
        drawHexagonText(origin, Layout.CARD_WIDTH / 3, 'white', companion.currentBurdens, 'black');
    }
}


function drawCompanionSlot(slot) {
    let companionSlot = gameState.cardsInCompanionSlots[slot];

    // Draw all the cards.
    companionSlot.forEach(card => {
        drawCardWithPreview(card);
    });
}

function drawPlayerCompanionCards() {
    // cardsInCompanionSlots should be "slots", and each have sub attachments.
    for (let i = 0; i < MAX_NUMBER_COMPANIONS; i++) {
        if (gameState.cardsInCompanionSlots[i]) {
            drawCompanionSlot(i);
        }
    }
    drawCompanionActionPanels();

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

function drawDeckPreview() {

    let i = 0;
    uiState.drawDeckPreviewCards.forEach(card => {
        card.x = (i % 20) * Layout.CARD_WIDTH;
        card.y = Math.floor(i / 20) * Layout.CARD_HEIGHT
        i++;
        drawCardWithPreview(card);
    })
}

// Draw stack.
function drawDrawDeck() {
    let numCardsInDrawDeck = gameState.cardsInDrawDeck.length
    if (numCardsInDrawDeck > 0) {
        for (let i = 0; i < numCardsInDrawDeck; i++) {
            gameState.cardsInDrawDeck[i].x = Layout.drawDeck.x + Layout.DRAW_DECK_SHIFT * Math.floor(Math.sqrt(i));
            drawCardReverse(gameState.cardsInDrawDeck[i])
        }
    }
}

function drawBackground() {
    ctx.clearRect(0, 0, logical.width, logical.height); // Clear the canvas
    ctx.fillStyle = 'rgb(25, 25, 25)';
    ctx.fillRect(0, 0, logical.width, logical.height);
    if (backgroundImage.complete) {
        ctx.drawImage(backgroundImage, 0, 0, logical.width, logical.height);
    }
}


// function drawDeadPile() {
//     let numCardsInDeadPile = gameState.cardsInPlayerDeadPile.length
//     if (numCardsInDeadPile > 0) {
//         let card = gameState.cardsInPlayerDeadPile[numCardsInDeadPile - 1];
//         drawCardRotated(card, 90);
//         if (isMouseOverCardRotated(card)) {
//             uiState.cardToPreview = card;
//         }
//     }
// }

function drawCompanionZones() {
    for (let i = 0; i < MAX_NUMBER_COMPANIONS; i++) {
        const rect = {
            x: Layout.companionZone.x + i * (Layout.COMPANION_SLOT_OFFSET), y: Layout.companionZone.y,
            width: Layout.CARD_WIDTH, height: Layout.CARD_HEIGHT
        }
        drawRectR(rect)
    }
}

function drawSiteCard(card, shadowColor) {
    drawCardRotated(card, 90, shadowColor);
    if (isMouseOverCardRotated(card)) {
        uiState.cardToPreview = card;
    }
}

function drawSiteCards() {
    for (let i = 0; i < gameState.cardsInSiteSlots.length; i++) {
        if (gameState.cardsInSiteSlots[i]) {
            drawSiteCard(gameState.cardsInSiteSlots[i], 'white')
        }
    }
}

function drawOpponentMinion(card) {
    if (gameState.opponent.minions[card.uuid]) {
        drawCardWithPreview(card, 'red');
        drawOpponentHealth(gameState.opponent.minions[card.uuid]);
        drawOpponentStrength(gameState.opponent.minions[card.uuid]);
    }
}

function drawOpponentCardsInPlay() {
    gameState.cardsInOpponentPlay.forEach(card => {
        if (card.cardType != "Minion") {
            drawCardWithPreview(card, 'red')
        } else {
            drawOpponentMinion(card);
        }
    });
}

function drawOpponentDiscardPile() {
    let numCardsInDiscard = gameState.cardsInOpponentsDiscard.length
    if (numCardsInDiscard > 0) {
        // draw rotated.
        let card = gameState.cardsInOpponentsDiscard[numCardsInDiscard - 1]
        card.x = Layout.opponentDiscardPile.x;
        card.y = Layout.opponentDiscardPile.y;
        drawCardWithPreview(card);
    }
}

function drawOpponentDeck() {
    let numCardsInDrawDeck = gameState.cardsInOpponentDrawDeck.length
    if (numCardsInDrawDeck > 0) {
        for (let i = 0; i < numCardsInDrawDeck; i++) {
            // draw a square decreasing draw deck.
            gameState.cardsInOpponentDrawDeck[i].y = Layout.opponentDeck.y;
            gameState.cardsInOpponentDrawDeck[i].x = Layout.opponentDeck.x + Layout.DRAW_DECK_SHIFT * Math.floor(Math.sqrt(i));
            drawCardReverse(gameState.cardsInOpponentDrawDeck[i])
        }
    }
}

function drawOpponentHand() {
    let i = 0;
    gameState.cardsInOpponentsHand.forEach(card => {
        card.x = Layout.opponentHand.x + Layout.PLAYER_HAND_OFFSET * i;
        card.y = Layout.opponentHand.y;
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
function drawOpponentCompanionSlot(slot, origin, slotNum) {
    let j = 0;
    let companionSlot = -1;

    for (let i = 0; i < slot.length; i++) {
        let card = slot[i];
        if (card && cardIsCompanionType(card) == false) {
            card.x = origin.x + j * (Layout.COMPANION_POSSESIONS_OFFSET);
            card.y = origin.y;
            j++;
            drawCardWithPreview(card, 'red', true);
        } else {
            companionSlot = i;
        }
    }
    if (companionSlot >= 0) {
        let card = slot[companionSlot];
        if (card) {
            card.x = origin.x + j * (Layout.COMPANION_POSSESIONS_OFFSET);
            card.y = origin.y;
            drawCardWithPreview(card);
            drawOpponentHealth(gameState.opponent.companions[card.uuid])
            drawOpponentStrength(gameState.opponent.companions[card.uuid]);
        }
    }
}

function drawOpponentCompanionCards() {
    for (let i = 0; i < MAX_NUMBER_COMPANIONS; i++) {
        let offset = {
            x: Layout.opponentCompanionZone.x + i * (Layout.COMPANION_SLOT_OFFSET),
            y: Layout.opponentCompanionZone.y
        }
        drawOpponentCompanionSlot(gameState.cardsInOpponentCompanionSlots[i], offset, i);
    }

}

function drawOpponentSupportCards() {
    let i = 0;
    gameState.cardsInOpponentSupportArea.forEach(card => {
        card.x = Layout.opponentSupportZone.x + Layout.PLAYER_HAND_OFFSET * i;
        card.y = Layout.opponentSupportZone.y;
        i++;
        drawCardWithPreview(card);
    });
}

function drawOpponentCompanionZones() {
    for (let i = 0; i < MAX_NUMBER_COMPANIONS; i++) {
        const rect = {
            x: Layout.opponentCompanionZone.x + i * (Layout.COMPANION_SLOT_OFFSET), y: Layout.opponentCompanionZone.y,
            width: Layout.CARD_WIDTH, height: Layout.CARD_HEIGHT
        }
        drawRectR(rect)
    }
}


function drawDiscardPreview() {
    drawRectR(Layout.discardPreviewArea, "Discard Pile here", 'rgba(255, 255, 255, 0.5');
    const numCardsInDiscard = gameState.cardsInPlayerDiscard.length;
    for (let i = 0; i < numCardsInDiscard; i++) {
        let card = gameState.cardsInPlayerDiscard[i];
        card.x = Layout.discardPreviewArea.x + (i % 10) * Layout.CARD_WIDTH;
        card.y = Layout.discardPreviewArea.y + Math.floor(i / 10) * Layout.CARD_HEIGHT;
        drawCardWithPreview(card)
    }
}

function drawCompanionPreview() {
    drawRectR(Layout.companionPreviewArea, "", 'rgba(128, 128, 128, 0.8');
    let i = 0;

    if (uiState.companionPreviewCards.length == 0) {
        return 0;
    }
    uiState.companionPreviewCards.forEach((card, key) => {
        card.x = Layout.companionPreviewArea.x + (i % 9) * (Layout.Margin + Layout.CARD_WIDTH);
        card.y = Layout.companionPreviewArea.y;
        drawCardWithPreview(card, "", 4.0);
        i++;
    })
}


function drawOpponentArea() {
    drawRectR(Layout.opponentDiscardPile, "Discard Pile")
    drawRectR(Layout.opponentHand, "Hand")
    drawRectR(Layout.opponentDeck, "Deck")
    drawRectR(Layout.opponentSupportZone, "Support")
    drawOpponentCompanionZones();
}


function drawPlayerArea() {
    drawSiteBorders();
    drawRectR(Layout.supportZone, "Support")
    drawRectR(Layout.playerHand, "Hand");
    drawRectR(Layout.discardPile, "Discard");
    drawRectR(Layout.drawDeck, "Deck empty");
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
    // drawDeadPile()


    drawPlayerSupportCards()
    drawPlayerCompanionCards()
}

function drawOpponentCards() {
    drawOpponentCardsInPlay();
    drawOpponentDiscardPile();
    drawOpponentDeck();
    drawOpponentHand();
    drawOpponentCompanionCards();
    drawOpponentSupportCards();
}

function drawPopups() {
    let popupActive = (uiState.discardPreviewActive || uiState.companionPreviewActive ||
        uiState.burdenBidPreviewActive || uiState.waitingOpponentBidPreviewActive ||
        uiState.moveAgainPreviewActive || uiState.drawDeckPreviewActive);

    if (popupActive) {
        drawRectR({ x: 0, y: 0, width: 1.0, height: 1.0 }, "", 'rgba(0, 0, 0, 0.7)')
    }
    if (uiState.discardPreviewActive) {
        drawDiscardPreview();
    } else if (uiState.companionPreviewActive) {
        drawCompanionPreview();
    } else if (uiState.drawDeckPreviewActive) {
        console.log("Drawing cards preview");
        drawDeckPreview();
    }
    if (uiState.cardToPreview) {
        if (uiState.cardToPreview.cardType === "Site") {
            drawCardPreviewRotated(uiState.cardToPreview);
        } else {
            drawCardPreview(uiState.cardToPreview)
        }
        uiState.cardToPreview = null
    }

    if (uiState.burdenBidPreviewActive) {
        drawBurdenBidPopup();
    }
    if (uiState.waitingOpponentBidPreviewActive) {
        drawWaitingBidPopup();
    }
    if (uiState.moveAgainPreviewActive) {
        drawMoveAgainPopup();
    }
}

function drawGrid() {
    for (let y = 0; y < 1.0; y) {
        let startX = 0.0;
        let startY = y * logical.height;
        let endX = logical.width;
        let endY = y * logical.height;

        ctx.beginPath();         // Start a new path
        ctx.moveTo(startX, startY);      // Move to starting point (x1, y1)
        ctx.lineTo(endX, endY);    // Draw line to (x2, y2)
        ctx.strokeStyle = 'rgba(255.0, 0.0, 0.0, 1.0'; // Set line color
        ctx.lineWidth = 1;       // Set line thickness
        ctx.stroke();            // Actually draw the line
        y = y + 0.1
    }

    for (let x = 0; x < 1.0;) {

        let startX = x * logical.width;
        let startY = 0.0;

        let endX = x * logical.width;
        let endY = logical.height;
        ctx.beginPath();         // Start a new path
        ctx.moveTo(startX, startY);      // Move to starting point (x1, y1)
        ctx.lineTo(endX, endY);    // Draw line to (x2, y2)
        ctx.strokeStyle = 'rgba(255.0, 0.0, 0.0, 1.0'; // Set line color
        ctx.lineWidth = 1;       // Set line thickness
        ctx.stroke();            // Actually draw the line
        x = x + 0.1
    }
}



let t = 0;

function drawOrbFrame(width, height) {
    const rOuter = width / 2 - 2;
    const rInner = rOuter - 10;

    // Outer ring
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, rOuter, 0, Math.PI * 2);
    ctx.strokeStyle = "#d4af37"; // gold
    ctx.lineWidth = 6;
    ctx.shadowBlur = 15;
    ctx.shadowColor = "#d4af3777";
    ctx.stroke();

    // Inner ring
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, rInner, 0, Math.PI * 2);
    ctx.strokeStyle = "#333";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.shadowBlur = 0;
}

function drawLiquid(width, height) {
    ctx.beginPath();
    const amplitude = 10;
    const frequency = 0.04;
    const waterLevel = height * 0.6;

    ctx.moveTo(0, height);
    for (let x = 0; x <= width; x++) {
        const y = waterLevel + Math.sin((x + t) * frequency) * amplitude;
        ctx.lineTo(x, y);
    }
    ctx.lineTo(width, height);

    ctx.fillStyle = "rgba(50, 150, 255, 0.6)";
    ctx.fill();
}


function drawOrb(x, y, width, height) {
    // Move to normalize coordiantes.
    x = x * logical.width;
    y = y * logical.height;
    // Orb clipping
    //ctx.clearRect(0, 0, width, height);

    ctx.save();
    {
        ctx.translate(x, y);
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, width / 2, 0, Math.PI * 2);
        ctx.clip();
        ctx.clearRect(0, 0, width, height);

        // Background gradient (glass effect)
        const glass = ctx.createRadialGradient(width * 0.3, height * 0.3, 10, width / 2, height / 2, width / 2);
        glass.addColorStop(0, "rgba(255, 255, 255, 0.2)");
        glass.addColorStop(1, "rgba(100, 150, 255, 0.05)");
        ctx.fillStyle = glass;
        ctx.fillRect(0, 0, width, height);

        // Blue liquid wave
        drawLiquid(width, height);

        // Border glow
        ctx.beginPath();
        ctx.arc(width / 2, height / 2, width / 2 - 1, 0, Math.PI * 2);
        ctx.strokeStyle = "#88cfff";
        ctx.lineWidth = 5;
        ctx.shadowBlur = 20;
        ctx.shadowColor = "#88cfff";
        ctx.stroke();
        ctx.shadowBlur = Math.sin(t / 60);

        // Number
        ctx.save();
        ctx.font = "bold 40px 'MedievalSharp', serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.strokeStyle = "#000"; // opaque black border
        ctx.lineWidth = 1;
        ctx.strokeText(gameState.twilight, width / 2, height / 2);
        ctx.fillStyle = "#fff";
        ctx.fillText(gameState.twilight, width / 2, height / 2);
        ctx.restore();
    }
    ctx.restore(); // end translate
}

function drawSiteToken(asset, site, offset, blur) {
    site = Math.min(9, site);
    let x = Layout.siteSlots[site - 1].x - 2 * Layout.Margin;
    let y = Layout.siteSlots[site - 1].y + offset * (Layout.CARD_WIDTH / 3);
    drawToken(x, y, asset, blur);
}

function drawSiteTokens() {
    drawSiteToken(gameState.player.token, gameState.player.currentSite, 0);
    if (gameState.opponent.token) {
        drawSiteToken(gameState.opponent.token, gameState.opponent.currentSite, 2, 'rgb(255,0,0)');
    }
}

function drawAllCards() {
    // Draw background image (TODO change each game or add option to change.)
    ctx.save(); // Save the current context state

    //ctx.transform(1, 0, 0.0,Math.sin(t/360),0, 0)

    drawBackground();

    // Card Zones.
    drawPlayerArea();
    drawOpponentArea();

    drawOpponentCards();
    drawPlayerCards();

    // sites.
    drawSiteCards();
    drawOpponentSiteCards();

    drawSiteTokens();
    drawGameState();
    drawPopups();

    ctx.restore();
}


function updateCardPosition(card, currentTime) {
    if (!card.animation.active)
        return;

    const elapsed = currentTime - card.animation.startTime;
    const t = Math.min(elapsed / card.animation.duration, 1); // normalize [0,1]

    const ease = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;// Smoother
    card.x = card.x + (card.animation.targetX - card.x) * ease;
    card.y = card.y + (card.animation.targetY - card.y) * ease;


    if (t >= 1) {
        card.x = card.animation.targetX;
        card.y = card.animation.targetY;
        card.animation.active = false;
    }
}

function renderScene(timestamp) {
    const STEP = 0.01;
    t += 1;
    let animationActive = false;

    if (uiState.animationCards.length > 0) {
        uiState.animationCards.forEach(card => {
            if (updateCardPosition(card, timestamp)) {
                animationActive = true;
            }
        });
    }

    // if (animationActive == false) {
    //     uiState.animationCards = []
    // }

    if (uiState.cardsDirty || 1) {
        drawAllCards();
        uiState.cardsDirty = false;
    }
    // drawOrb(Layout.twilightContainerArea.x, Layout.twilightContainerArea.y, 50, 50);
    requestAnimationFrame(renderScene);
}

function draw() {
    uiState.cardsDirty = true;
}


// ================================================
// IPC handling and sending
// ================================================

// ============================================================
// Card Management, needs events to be sent back to server.
// ============================================================
const CARD_EVENT = "cardEvent";
const CARD_EVENT_MOVED = "moveCard";
const CARD_EVENT_LOCATION_PLAY_AREA = "playArea";
const CARD_EVENT_LOCATION_PLAYER_HAND = "playerHand";
const CARD_EVENT_LOCATION_DISCARD = "playerDiscard";
// const CARD_EVENT_LOCATION_DEAD_PILE = "playerDeadPile";
const CARD_EVENT_LOCATION_COMPANION_AREA = "playerCompanion";
const CARD_EVENT_LOCATION_SUPPORT_AREA = "playerSupportArea";
const CARD_EVENT_LOCATION_DRAW_DECK = "playerDrawDeck";
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
        type: CARD_EVENT_MOVED,
        cardId: card.id,
        cardUuid: card.uuid,
        cardType: card.cardType,
        fromPile: _from,
        toPile: _to,
        position: { x: card.x, y: card.y }, // only relevant for in play cards.
        playerId: gameState.player.name,
        index: _index // 
    }
    console.log("Dispatching cardMovedEvent: %s", JSON.stringify(event, null, 2))
    document.dispatchEvent(new CustomEvent(CARD_EVENT, { detail: event }));
}

function placeCardInHand(from, card) {
    console.log("Placing %s into hand", card.id)

    // Snap to end of hand location
    let numCardsInHand = gameState.cardsInPlayerHand.length;

    // TODO: CHeck hand size.
    gameState.cardsInPlayerHand.push(card)

    //    Reshuffle/organize playerhand
    for (let i = numCardsInHand; i >= 0; i--) {
        let card = gameState.cardsInPlayerHand[i];
        card.x = Layout.playerHand.x + i * Layout.PLAYER_HAND_OFFSET;
        card.y = Layout.playerHand.y;
    }
    sendCardMovedEvent(from, CARD_EVENT_LOCATION_PLAYER_HAND, card);
    return true;
}

function initializeMinion(card) {
    let minionInfo = {
        card: card,
        currentWounds: 0,
        currentBurdens: 0,
        strengthModifier: 0,
    }

    createActionPanel(minionInfo);
    gameState.player.minions[card.uuid] = minionInfo;
}

function handleMinionPlayed(card) {
    if (gameState.player.minions[card.uuid]) {
        console.log("Minion already active,nothing to do");
    } else {
        initializeMinion(card);
    }
}

function placeCardOnPlayArea(from, card) {
    console.log("Moving card onto table id:%s", card.id)
    gameState.cardsInPlay.push(card);

    if (card.cardType == "Minion") {
        handleMinionPlayed(card);
    }
    sendCardMovedEvent(from, CARD_EVENT_LOCATION_PLAY_AREA, card);

    return true;
}

function removeMinionFromPlay(card) {
    if (gameState.player.minions[card.uuid]) {
        gameState.player.minions[card.uuid] = null;
    }
}
function removeCompanionFromPlay(card) {
    if (gameState.player.companions[card.uuid]) {
        gameState.player.companions[card.uuid] = null;
    }
}

function placeCardInDiscard(from, card) {
    console.log("Discarding card id:%s", card.id)

    gameState.cardsInPlayerDiscard.push(card)

    card.x = Layout.discardPile.x;
    card.y = Layout.discardPile.y;

    sendCardMovedEvent(from, CARD_EVENT_LOCATION_DISCARD, card);

    removeMinionFromPlay(card);
    removeCompanionFromPlay(card);
    return true;
}


// function placeCardInDeadPile(from, card) {
//     console.log("Adding card to dead pile id:%s", card.id)

//     gameState.cardsInPlayerDeadPile.push(card)

//     card.x = Layout.deadPile.x
//     card.y = Layout.deadPile.y

//     sendCardMovedEvent(from, CARD_EVENT_LOCATION_DEAD_PILE, card);

//     // remove activeCompanionInformation.
//     removeCompanionFromPlay(card);
//     return true;
// }

function placeCardAtSite(from, card, siteNum) {
    console.log("Adding card to site :%d", (siteNum + 1))

    if (siteNum < Layout.siteSlots.length) {
        if (gameState.cardsInSiteSlots[siteNum] || gameState.cardsInOpponentSite[siteNum]) {
            console.log("Card already exists at site: %d", siteNum + 1)
        } else {
            gameState.cardsInSiteSlots[siteNum] = card;
            card.x = Layout.siteSlots[siteNum].x
            card.y = Layout.siteSlots[siteNum].y
            sendCardMovedEvent(from, "site", card, siteNum)
            return true;
        }
    }
    return false;
}

function handleSitePlacement(from, card) {
    for (let i = 0; i < Layout.siteSlots.length; i++) {
        let site = Layout.siteSlots[i]
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
        card.x = Layout.supportZone.x + i * Layout.PLAYER_HAND_OFFSET;
        card.y = Layout.supportZone.y;
    }

    sendCardMovedEvent(from, CARD_EVENT_LOCATION_SUPPORT_AREA, card);
    return true;
}

function cardIsCompanionType(card) {
    return card.cardType == "Companion" || card.cardType == "RingBearer" || card.cardType == "Ally"
}

function restackCompanionSlot(slotNum) {
    const slotOrigin = { x: Layout.companionZone.x + slotNum * Layout.COMPANION_SLOT_OFFSET, y: Layout.companionZone.y }
    const companionSlot = gameState.cardsInCompanionSlots[slotNum];
    const numCardsInSlot = companionSlot.length;
    let offset = 0;
    let i = 0;

    for (i = 0; i < gameState.cardsInCompanionSlots[slotNum].length; i++) {
        let card = gameState.cardsInCompanionSlots[slotNum][i];
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

    gameState.cardsInCompanionSlots[slotNum].forEach(card => {
        // Draw stack of possesions/support/etc first
        card.x = slotOrigin.x + offset * Layout.COMPANION_POSSESIONS_OFFSET;
        card.y = slotOrigin.y;
        offset++;
    });

}

function createActionPanel(characterInfo) {
    let card = characterInfo.card;
    console.log("initializing action panel for : %s", JSON.stringify(characterInfo, 2, null))
    let healButton = {
        x: card.x, y: card.y - Layout.Margin,
        width: Layout.buttonWidth, height: Layout.buttonHeight, label: "Heal",
        callback: () => {
            characterInfo.currentWounds = Math.max(0, characterInfo.currentWounds - 1);
            sendCharacterEvent(characterInfo);
        }
    }

    let woundButton = {
        x: card.x + Layout.buttonWidth, y: card.y - Layout.Margin,
        width: Layout.buttonWidth, height: Layout.buttonHeight, label: "Wound",
        callback: () => {
            characterInfo.currentWounds = Math.min(MAX_HEALTH, characterInfo.currentWounds + 1);
            sendCharacterEvent(characterInfo);
        }
    }

    const STR_WIDTH_MOD = 0.75;
    let weakenButton = {
        x: card.x, y: card.y,
        width: Layout.buttonWidth * STR_WIDTH_MOD, height: Layout.buttonHeight, label: "WeakenPanel",
        callback: () => {
            characterInfo.actionPanel.woundRadial.open = !characterInfo.actionPanel.woundRadial.open;
        }
    }

    let burdenIndicator = {
        x: weakenButton.x + weakenButton.width, y: weakenButton.y,
        width: Layout.buttonWidth * STR_WIDTH_MOD, height: Layout.buttonHeight, label: "BurdenPanel",
        callback: () => {
            characterInfo.actionPanel.burdenRadial.open = !characterInfo.actionPanel.burdenRadial.open;
        }
    }
    let strengthIndicator = {
        x: weakenButton.x + weakenButton.width, y: weakenButton.y,
        width: Layout.buttonWidth * STR_WIDTH_MOD, height: Layout.buttonHeight, label: "StrengthPanel",
        callback: () => {
            characterInfo.actionPanel.strengthRadial.open = !characterInfo.actionPanel.strengthRadial.open;
        }
    }

    let strengthRadial = {
        x: 0, y: 0, r: 0.03,
        leftCallback: () => {
            characterInfo.strengthModifier -= 1;
            sendCharacterEvent(characterInfo);
        },
        rightCallback: () => {
            characterInfo.strengthModifier += 1;
            sendCharacterEvent(characterInfo);
        },
        open: false,
    }


    let woundRadial = {
        x: 0, y: 0, r: 0.03,
        leftCallback: () => {
            characterInfo.currentWounds = Math.max(0, characterInfo.currentWounds - 1);
            sendCharacterEvent(characterInfo);
        },
        rightCallback: () => {
            characterInfo.currentWounds = Math.min(MAX_HEALTH, characterInfo.currentWounds + 1);
            sendCharacterEvent(characterInfo);
        },
        open: false
    }

    let burdenRadial = {
        x: 0, y: 0, r: 0.03,
        leftCallback: () => {
            characterInfo.currentBurdens = Math.max(0, characterInfo.currentBurdens - 1);
            sendCharacterEvent(characterInfo);
        },
        rightCallback: () => {
            characterInfo.currentBurdens = Math.min(MAX_BURDENS, characterInfo.currentBurdens + 1);
            sendCharacterEvent(characterInfo);
        },
        open: false
    }

    let healthBar = {
        x: woundButton.x, y: woundButton.y - (Layout.healthBarHeight + Layout.Margin),
        width: Layout.healthBarWidth, height: Layout.healthBarHeight
    }

    let burdenBar = {
        x: healthBar.x, y: healthBar.y - (Layout.healthBarHeight + Layout.Margin),
        width: Layout.healthBarWidth, height: Layout.healthBarHeight
    }

    let actionPanel = {
        origin: { x: card.x, y: card.y },
        wound: woundButton,
        heal: healButton,
        healthBar: healthBar,
        burdenBar: burdenBar,

        wounds: weakenButton,
        woundRadial: woundRadial,
        strength: strengthIndicator,
        strengthRadial: strengthRadial,
        burdens: burdenIndicator,
        burdenRadial: burdenRadial,
    }

    characterInfo.actionPanel = actionPanel;
}

function initializeCompanion(card, slotNum) {
    let companionInfo = {
        card: card,
        currentWounds: 0,
        currentBurdens: 0,
        strengthModifier: 0,
        homeSlot: slotNum,
    }
    // it is a map, so the location of the card does not matter.
    gameState.player.companions[card.uuid] = companionInfo;
    createActionPanel(companionInfo);
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
    let companionSlot = gameState.cardsInCompanionSlots[slotNum];
    let companionSlotOccupied = slotHasCompanion(companionSlot);
    let cardIsCompanion = cardIsCompanionType(card);

    console.log("Placing card : %s in companion slot: %d", JSON.stringify(card, 2, null), slotNum);

    if (companionSlotOccupied == false) {
        if (cardIsCompanion == false) {
            console.error("Cannot place non-companion in companion slot first, type is : '%s'", card.cardType);
            return false;
        }
        if (gameState.player.companions[card.uuid]) {
            console.log("Companion already has slot");
        } else {
            initializeCompanion(card, slotNum);
        }
    } else if (companionSlotOccupied) {
        if (cardIsCompanion) {
            console.error("Companion already at slot %d", slotNum);
            return false;
        }
    }

    companionSlot.push(card);
    restackCompanionSlot(slotNum);

    sendCardMovedEvent(from, CARD_EVENT_LOCATION_COMPANION_AREA, card, slotNum);
    return true;
}

function placeCardInCompanionPile(from, card) {
    let offset = uiState.mouseX - Layout.companionZone.x;
    let slotNum = Math.floor(offset / (Layout.companionZone.width / MAX_NUMBER_COMPANIONS));

    return placeCardInCompanionSlot(from, card, slotNum);
}

function placeCardInFreeCompanionSlot(from, card) {
    let i = 0;
    console.log("Placing card in a companion slot");
    for (i = 0; i < MAX_NUMBER_COMPANIONS; i++) {
        if (gameState.cardsInCompanionSlots[i].length == 0) {
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
            return true;
        }
    }
    return false;
}

// Card moved from origin, figure out where it went.
function handleGenericCardMoved(from, selectedCard) {
    const dropZones = [
        { toArea: Layout.playerHand, action: placeCardInHand },
        { toArea: Layout.discardPile, action: placeCardInDiscard },
        { toArea: Layout.companionZone, action: placeCardInCompanionPile },
        { toArea: Layout.supportZone, action: placeCardInSupportPile },
        // { toArea: Layout.deadPile, action: placeCardInDeadPile },
    ]

    for (const zone of dropZones) {
        if (mouseInArea(zone.toArea)) {
            if (zone.action(from, selectedCard)) {
                return true;
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
        let index = gameState.cardsInPlayerDiscard.indexOf(uiState.activelySelectedCard);
        if (index !== -1) {
            const selectedCard = gameState.cardsInPlayerDiscard.splice(i, 1)[0];
            placeCardInHand(CARD_EVENT_LOCATION_DISCARD, selectedCard);
            return true;
        }
    }
    return false;
}
function handleDrawDeckPreviewTapped() {

}

function checkCardTapped() {
    for (const handler of [handleDrawDeckPreviewTapped,
        handleCompanionPreviewTapped, handleDrawDeckTapped, handleSiteSlotTapped, handleDiscardCardTapped]) {
        if (handler())
            return true;
    }
    return false;
}


function checkCardReleased(fromPile, pile) {

    const index = pile.indexOf(uiState.activelySelectedCard);
    if (index !== -1) {
        console.log("Removing a card and handling it generically");
        const selectedCard = pile.splice(index, 1)[0];
        handleGenericCardMoved(fromPile, selectedCard);
        uiState.activelySelectedCard = null;
        return true;
    }
    return false;
}

function handleSiteCardRelease() {
    const index = gameState.cardsInSiteSlots.indexOf(uiState.activelySelectedCard);
    if (index !== -1) {
        handleGenericCardMoved("site" + (index + 1), uiState.activelySelectedCard);
        delete gameState.cardsInSiteSlots[index];
        uiState.activelySelectedCard = null;
        return true;
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
            console.log("Cards in hand : %d", gameState.cardsInPlayerHand.length)
            if (gameState.cardsInPlayerHand.length < MAX_CARDS_IN_HAND) {
                let randomIndex = Math.floor(Math.random() * gameState.cardsInDrawDeck.length);
                const pulledCard = gameState.cardsInDrawDeck.splice(randomIndex, 1)[0];
                placeCardInHand(CARD_EVENT_LOCATION_PLAYER_HAND, pulledCard);
            } else {
                alert("Max number of cards added")
            }
        }
    }
}
function removeCardFromDeck(uuid) {
    let offset = -1;
    console.log("Searching for %s", uuid);
    for (let i = 0; i < gameState.cardsInDrawDeck.length; i++) {
        if (gameState.cardsInDrawDeck[i].uuid == uuid) {
            console.log("Found matching card ref :%s", uuid);
            offset = i;
            break;
        }
    }
    if (offset >= 0) {
        console.log("Removing %s (%s) from deck", uuid);
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

    let targetCard = null
    // Remove corresponding card from draw deck into companion slot.
    uiState.companionPreviewCards.forEach((card, id) => {
        console.log("Is mouse over %s?", card.id)
        if (isMouseOverCard(card)) {
            targetCard = card;
        }
    });

    if (targetCard) {
        uiState.companionPreviewCards.delete(targetCard.id);
        let pulledCard = removeCardFromDeck(targetCard.uuid);
        if (pulledCard) {
            placeCardInFreeCompanionSlot("playerDeck", pulledCard);
        } else {
            console.error("Could not find card in draw decK??");
        }
    }
}


function handleSiteSlotTapped() {
    for (let i = 0; i < Layout.siteSlots.length; i++) {
        if (isMouseOverCard(Layout.siteSlots[i])) {
            return playSiteFromDeck(i + 1);
        }
    }
    return false;
}

function handleCompanionCardsReleased(tapped) {
    let i = 0;
    gameState.cardsInCompanionSlots.forEach(slot => {
        checkCardReleased(("playerCompanion" + i), slot);
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
        { name: CARD_EVENT_LOCATION_PLAY_AREA, pile: gameState.cardsInPlay },
        { name: CARD_EVENT_LOCATION_PLAYER_HAND, pile: gameState.cardsInPlayerHand },
        // { name: CARD_EVENT_LOCATION_DEAD_PILE, pile: gameState.cardsInPlayerDeadPile },
        { name: CARD_EVENT_LOCATION_SUPPORT_AREA, pile: gameState.cardsInSupportArea },
        { name: CARD_EVENT_LOCATION_DISCARD, pile: gameState.cardsInPlayerDiscard },
    ]

    for (let dispatch of cardReleaseDispatch) {
        if (checkCardReleased(dispatch.name, dispatch.pile)) {
            console.log("Card event handled for pile : %s", dispatch.name);
            break;
        }
    }
    handleSiteCardRelease(tapped);
    handleCompanionCardsReleased(tapped);

    uiState.activelySelectedCard = null; // backstop
    draw();
});

function checkButtonClicked(button) {
    if (
        uiState.mouseX >= button.x && uiState.mouseX <= button.x + button.width &&
        uiState.mouseY >= button.y && uiState.mouseY <= button.y + button.height
    ) {
        console.log("%s clicked", button.label)
        button.callback();
    }
}

function math_magnitude(vector) {
    return Math.sqrt(vector.x * vector.x + vector.y * vector.y);
}

function checkRadialButtonClicked(radial) {
    let o = { x: radial.x, y: radial.y }
    let v = { x: uiState.mouseX - o.x, y: -(uiState.mouseY - o.y) } // map to unit circle coordinates
    let r = math_magnitude(v);
    let theta = ((Math.atan2(v.y, v.x) * (360 / (2 * Math.PI))) + 360) % 360;
    if (r < radial.r) {
        if (theta < 90 || theta > 330) {
            radial.rightCallback();
        } else if (theta > 90 && theta < 210) {
            radial.leftCallback();
        }
    }
}

function checkActionPanelClicked(actionPanel) {
    // legacy buttons.
    // checkButtonClicked(actionPanel.wound);
    // checkButtonClicked(actionPanel.heal);

    checkButtonClicked(actionPanel.wounds);
    checkButtonClicked(actionPanel.strength);
    checkButtonClicked(actionPanel.burdens);

    if (actionPanel.strengthRadial.open) {
        checkRadialButtonClicked(actionPanel.strengthRadial);
    }
    if (actionPanel.woundRadial.open) {
        checkRadialButtonClicked(actionPanel.woundRadial);
    }
    if (actionPanel.burdenRadial.open) {
        checkRadialButtonClicked(actionPanel.burdenRadial);
    }
}
function checkButtonsClicked() {

    Object.entries(gameState.player.companions).forEach(([id, companion]) => {
        if (companion && companion.actionPanel) {
            checkActionPanelClicked(companion.actionPanel);
        }
    })
    Object.entries(gameState.player.minions).forEach(([id, minion]) => {
        if (minion && minion.actionPanel) {
            checkActionPanelClicked(minion.actionPanel);
        }
    })
    uiState.siteButtons.forEach(button => {
        checkButtonClicked(button);
    });

    if (uiState.burdenBidPreviewActive) {
        uiState.burdenBidButtons.forEach(button => {
            checkButtonClicked(button);
        })
        checkButtonClicked(uiState.burdenBidSubmitButton);
    }

    if (uiState.moveAgainPreviewActive) {
        uiState.regroupButtons.forEach(button => {
            checkButtonClicked(button);
        })
    }

    uiState.gameStateButtons.forEach(button => {
        checkButtonClicked(button);
    });
}

canvas.addEventListener('click', () => {
    checkCardTapped();
    checkButtonsClicked();
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
    uiState.mouseX = e.offsetX / logical.width;
    uiState.mouseY = e.offsetY / logical.height;
    uiState.startX = uiState.mouseX
    uiState.startY = uiState.mouseY

    // Search decks that have "draggable" cards.
    const cardPiles = [
        { cards: gameState.cardsInPlayerHand, vertical: true },
        { cards: gameState.cardsInPlayerDiscard, vertical: true },
        { cards: gameState.cardsInPlay, vertical: true },
        { cards: gameState.cardsInSupportArea, vertical: true },
        { cards: gameState.cardsInSiteSlots, vertical: false },
        // { cards: gameState.cardsInPlayerDeadPile, vertical: false }
    ]
    // Check companion cards + possesions
    gameState.cardsInCompanionSlots.forEach(slot => { cardPiles.push({ cards: slot, vertical: true }); });

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

function mouseOverButton(btn) {
    return uiState.mouseX >= btn.x && uiState.mouseX <= btn.x + btn.width &&
        uiState.mouseY >= btn.y && uiState.mouseY <= btn.y + btn.height
}

function mouseOverRadialButton(radial) {
    let o = { x: radial.x, y: radial.y }
    let v = { x: uiState.mouseX - o.x, y: -(uiState.mouseY - o.y) } // map to unit circle coordinates
    let r = math_magnitude(v);
    let theta = ((Math.atan2(v.y, v.x) * (360 / (2 * Math.PI))) + 360) % 360;

    return (r < radial.r && (theta > 330 || theta < 210));
}

function checkButtonHover() {
    let hovering = false;

    Object.entries(gameState.player.companions).forEach(([id, companion]) => {
        if (companion) {
            let actionPanel = companion.actionPanel;
            // actionPanel.wound, actionPanel.heal
            for (const btn of [actionPanel.burdens, actionPanel.wounds, actionPanel.strength]) {
                if (mouseOverButton(btn)) {
                    hovering = true;
                    break;
                }
            }
            for (const radial of [actionPanel.burdenRadial, actionPanel.strengthRadial, actionPanel.woundRadial]) {
                if (mouseOverRadialButton(radial)) {
                    hovering = true;
                    break;
                }
            }
        }
    });

    Object.entries(gameState.player.minions).forEach(([id, minion]) => {
        if (minion) {
            let actionPanel = minion.actionPanel;
            for (const btn of [actionPanel.wound, actionPanel.heal, actionPanel.wounds, actionPanel.strength]) {
                if (mouseOverButton(btn)) {
                    hovering = true;
                    break;
                }
            }
            for (const radial of [actionPanel.strengthRadial, actionPanel.woundRadial]) {
                if (mouseOverRadialButton(radial)) {
                    hovering = true;
                    break;
                }
            }
        }
    });

    uiState.siteButtons.forEach(btn => {
        if (mouseOverButton(btn)) {
            hovering = true;
        }
    })
    uiState.gameStateButtons.forEach(btn => {
        if (mouseOverButton(btn)) {
            hovering = true;
        }
    })
    if (uiState.burdenBidPreviewActive) {
        uiState.burdenBidButtons.forEach(btn => {
            if (mouseOverButton(btn)) {
                hovering = true;
            }
        })
        if (mouseOverButton(uiState.burdenBidSubmitButton)) {
            hovering = true;
        }
    }
    if (uiState.moveAgainPreviewActive) {
        uiState.regroupButtons.forEach(btn => {
            if (mouseOverButton(btn)) {
                hovering = true;
            }
        })
    }
    canvas.style.cursor = hovering ? 'url(assets/cursor_pointer.png), pointer' : 'url(assets/cursor_default.png), default'
}

// Handle mouse move event to drag the card
canvas.addEventListener('mousemove', (e) => {

    uiState.mouseX = e.offsetX / logical.width;
    uiState.mouseY = e.offsetY / logical.height;
    // Draw drag movement.
    if (uiState.activelySelectedCard) {
        handleCardDragged();
    }

    checkButtonHover();
    draw();
});

function playRingBearerFromDeck() {
    let bearer = null;
    let ring = null;

    for (let i = 0; i < gameState.cardsInDrawDeck.length; i++) {
        let card = gameState.cardsInDrawDeck[i];
        if (card.cardType == "RingBearer") {
            bearer = card;
        } else if (card.cardType == "Ring") {
            ring = card;
        }
    }

    if (ring && bearer) {
        removeCardFromDeck(ring.uuid);
        removeCardFromDeck(bearer.uuid);
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
        // "playerDeadPile": gameState.cardsInOpponentDeadPile,
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
            console.log("Invalid pile to search '%s'", fromPileName);
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
        // console.warn("Moving existing card (%s)", JSON.stringify(existingCard, null, 2))
        animateCardTo(existingCard, eventData.position);
        toPile.push(existingCard);
    } else {

        let card = initCard(eventData.cardId, eventData.cardType);

        card.uuid = eventData.cardUuid; // override uuid generated ref.
        // Assume card is coming from deck.
        card.x = Layout.opponentDeck.x;
        card.y = Layout.opponentDeck.y;
        // console.warn("New card played %s" ,JSON.stringify(card, null, 2))
        animateCardTo(card, eventData.position)
        toPile.push(card);
    }
}

function initializeOpponentCompanion(card, slotNum) {
    let companionInfo = {
        card: card,
        currentWounds: 0,
        currentBurdens: 0,
        strengthModifier: 0,
        homeSlot: slotNum
    }
    console.log("Creating Opponent Companion Info :%s", JSON.stringify(companionInfo, 2, null));
    gameState.opponent.companions[card.uuid] = companionInfo;
}

function restackOpponentSlot(companionSlot, slotNum) {
    // First check if a companionInfo has been initialized:
    let i = 0;
    for (i = 0; i < companionSlot.length; i++) {
        let card = companionSlot[i];
        if (card && cardIsCompanionType(card)) {
            if (gameState.opponent.companions[card.uuid]) {
                console.log("Opponent Companion already tracked");
            } else {
                initializeOpponentCompanion(card, slotNum)
            }
            break;
        }
    }
}

function initializeOpponentMinion(card) {
    let minionInfo = {
        card: card,
        currentWounds: 0,
        currentBurdens: 0,
        strengthModifier: 0,
    }
    console.log("Creating Opponent Minion Info :%s", JSON.stringify(minionInfo, 2, null));
    gameState.opponent.minions[card.uuid] = minionInfo;
}

function updateOpponentMinionInfo(targetCard) {
    gameState.cardsInOpponentPlay.forEach(card => {
        if (card.cardType == "Minion") {
            if (gameState.opponent.minions[card.uuid]) {
                console.log("Opponent minion already tracked.");
            } else {
                initializeOpponentMinion(card);
            }
        }
    });
}

function updateOpponentCompanionInfo(eventData) {
    for (let slotNum = 0; slotNum < gameState.cardsInOpponentCompanionSlots.length; slotNum++) {
        restackOpponentSlot(gameState.cardsInOpponentCompanionSlots[slotNum], slotNum);
    };
}

function handleRemotePlayAreaCard(eventData) {
    // Since these are "free form cards", we actually want to play them
    // in relation to the opponent, so mirror the Y  equator using the y-midpoint
    // of the card
    let y_mid = eventData.position.y + Layout.CARD_HEIGHT;
    eventData.position.y = (1.0 - y_mid);
    commonRemoteCardAction(eventData, gameState.cardsInOpponentPlay);
    updateOpponentMinionInfo(eventData);
}

function handleRemotePlayerHand(eventData) {
    commonRemoteCardAction(eventData, gameState.cardsInOpponentsHand);
}

function handleRemotePlayerDiscard(eventData) {
    commonRemoteCardAction(eventData, gameState.cardsInOpponentsDiscard);
}

// function handleRemotePlayerDeadPile(eventData) {
//     commonRemoteCardAction(eventData, gameState.cardsInOpponentDeadPile)
// }

function handleRemotePlayerCompanionArea(eventData) {
    commonRemoteCardAction(eventData, gameState.cardsInOpponentCompanionSlots[eventData.index]);
    updateOpponentCompanionInfo(eventData);
}

function handleRemotePlayerSupportArea(eventData) {
    commonRemoteCardAction(eventData, gameState.cardsInOpponentSupportArea)
}

function handleRemotePlayerSite(eventData) {
    const siteNumIdx = eventData.index;

    if (siteNumIdx < 0 || siteNumIdx >= Layout.siteSlots.length) {
        console.error("invalid site Number")
        return;
    }
    if (gameState.cardsInSiteSlots[siteNumIdx]) {
        console.error("Card already exists in our site(%d), logic error?", siteNum)
        return;
    }
    if (gameState.cardsInOpponentSite[siteNumIdx]) {
        console.error("Card already exists for opponent in that site(%d)", siteNum);
        return;
    }
    // Lets check if it moved from an existing area( player Hand, etc)
    let existingCard = findCardFromExistingPile(eventData);
    if (existingCard) {
        console.log("Moving existing  card(%d)", existingCard.uuid)
        existingCard.x = Layout.siteSlots[siteNumIdx].x
        existingCard.y = Layout.siteSlots[siteNumIdx].y
        gameState.cardsInOpponentSite[siteNumIdx] = existingCard;
    } else {
        let card = initCard(eventData.cardId, eventData.cardType, siteNumIdx + 1);
        card.uuid = eventData.cardUuid; // override uuid generated ref.
        card.x = Layout.siteSlots[siteNumIdx].x;
        card.y = Layout.siteSlots[siteNumIdx].y
        gameState.cardsInOpponentSite[siteNumIdx] = card;
    }
}

function moveToNextSite(delta) {
    // console.log("Move to next site :%d", delta)


    let curSite = gameState.player.currentSite;
    gameState.player.currentSite = Math.max(1, Math.min(9, curSite + delta));
    sendPlayerMovedEvent(gameState.player.currentSite);
    draw();
};


function changeTwilightCounter(delta) {
    gameState.twilight += delta;
    document.getElementById("twlightCounter").textContent = gameState.twilight;
    sendTwilightChangedEvent(gameState.twilight);
}

document.getElementById("twilightUp").addEventListener("click", () => {
    changeTwilightCounter(1)
});

document.getElementById("twilightDown").addEventListener("click", () => {
    changeTwilightCounter(-1)
});

function changeBurden(delta) {
    Object.entries(gameState.player.companions).forEach(([id, companion]) => {
        if (companion.card.cardType == "RingBearer") {
            companion.currentBurdens = Math.max(0, (Math.min(MAX_BURDENS, companion.currentBurdens + delta)));
            sendCharacterEvent(companion)
        }
    });

    draw();
}

function toggleCompanionPreview() {
    if (uiState.companionPreviewActive == false) {
        uiState.companionPreviewActive = true;

        gameState.cardsInDrawDeck.forEach(card => {
            if (cardIsCompanionType(card)) {
                // Unique only.
                if (uiState.companionPreviewCards.has(card.id) == false) {
                    console.log("Setting map.... %s => %s", card.id, card)
                    uiState.companionPreviewCards.set(card.id, card);
                }
            }
        });
        console.log("Map ->", Object.fromEntries(uiState.companionPreviewCards));
        uiState.companionPreviewCards.forEach((card, key) => {
            console.log("Map has:", key, card);
        });
    } else {
        uiState.companionPreviewActive = false;
        uiState.companionPreviewCards.forEach((card, key) => {
            card.x = Layout.drawDeck.y;
            card.y = Layout.drawDeck.y;
        })
    }
}

function toggleDeckPreview() {
    if (uiState.drawDeckPreviewActive == false) {
        uiState.drawDeckPreviewActive = true;
        // eh ineffiecient?
        uiState.drawDeckPreviewCards = JSON.parse(JSON.stringify(gameState.cardsInDrawDeck));
    } else {
        uiState.drawDeckPreviewActive = false;
    }
}

function resetDiscardPreview() {
    gameState.cardsInPlayerDiscard.forEach(card => {
        card.x = Layout.discardPile.x;
        card.y = Layout.discardPile.y;
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



function showBurdenBidPopup(show = true) {
    if (show) {
        gameState.player.burdensBid = 0; // Set initial bid to 0, so if submit is called, its valid.
        uiState.burdenBidPreviewActive = true;
    } else {
        uiState.burdenBidPreviewActive = false;
    }
}

function showWaitingBurdenBidPopup(show = true) {
    if (show) {
        uiState.waitingOpponentBidPreviewActive = true;
    } else {
        uiState.waitingOpponentBidPreviewActive = false;
    }
}

function showMoveAgainPrompt(show = true) {
    if (show) {
        uiState.moveAgainPreviewActive = true;
    } else {
        uiState.moveAgainPreviewActive = false;
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

document.getElementById("viewDeckButton").addEventListener("click", () => {
    toggleDeckPreview();
    draw();
})


// document.getElementById("saveGameButton").addEventListener("click", () => {
//     saveGame(gameState);
// });

// document.getElementById("loadGameButton").addEventListener("click", () => {
//     let savedGame = loadGame(gameState.gameId);
//     if (savedGame) {
//         gameState = savedGame;
//         uiState.discardPreviewActive = false;
//         uiState.companionPreviewActive = false;
//         uiState.burdenBidPreviewActive = false;
//     }
// })

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
        // "playerDeadPile": handleRemotePlayerDeadPile,
        "playerCompanion": handleRemotePlayerCompanionArea,
        "playerSupportArea": handleRemotePlayerSupportArea
    }
    if (cardEventDispatch[eventData.toPile]) {
        cardEventDispatch[eventData.toPile](eventData);
    } else if (eventData.toPile.includes("site")) {
        handleRemotePlayerSite(eventData);
    }
    Notification.showNotification("Opponent played" + eventData.cardId + " to " + eventData.toPile);
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
    gameState.opponent.initialized = true;
    gameState.opponent.token = eventData.token
}

function handleTwilightChanged(eventData) {
    document.getElementById("twlightCounter").textContent = parseInt(eventData.twilight);
    gameState.twilight = parseInt(eventData.twilight);
}

function handleOpponentCharacterChanged(eventData) {
    let characterEvent = eventData;

    if (gameState.opponent.companions[characterEvent.character]) {
        gameState.opponent.companions[characterEvent.character].currentWounds = eventData.wounds;
        gameState.opponent.companions[characterEvent.character].currentBurdens = eventData.burdens;
        gameState.opponent.companions[characterEvent.character].strengthModifier = eventData.strengthModifier;
    } else if (gameState.opponent.minions[characterEvent.character]) {
        gameState.opponent.minions[characterEvent.character].currentWounds = eventData.wounds;
        gameState.opponent.minions[characterEvent.character].currentBurdens = eventData.burdens;
        gameState.opponent.minions[characterEvent.character].strengthModifier = eventData.strengthModifier;
    } else {
        console.error("Got wound event for character %s, which does not exist yet?", characterEvent.character)
    }
}

function handlePlayerMovedEvent(eventData) {
    gameState.opponent.currentSite = eventData.site;
    playSiteFromDeck(gameState.opponent.currentSite);
    draw();
}

function handleOpponentBurdensBidEvent(eventData) {
    gameState.opponent.burdensBid = eventData.burdens;
    gameStateMachine(GAME_STATE_EVENT_OPPONENT_BURDENS_BID);
}

function handlePhaseFinishedEvent(eventData) {
    gameStateMachine(GAME_STATE_EVENT_OPPONENT_PHASE_FINISHED);
}
function handleEndTurnEvent(eventData) {
    gameStateMachine(GAME_STATE_EVENT_OPPONENT_TURN_ENDED);
}


// const gameStateMachine = {
//     "init": {
//         "burdensBid": "play"
//     }
// }
const GAME_STATE_EVENT_INIT = 0;
const GAME_STATE_EVENT_BURDENS_BID = 1;
const GAME_STATE_EVENT_OPPONENT_BURDENS_BID = 2;
const GAME_STATE_EVENT_PHASE_FINISHED = 3;
const GAME_STATE_EVENT_OPPONENT_PHASE_FINISHED = 4;
const GAME_STATE_EVENT_END_TURN = 5;
const GAME_STATE_EVENT_OPPONENT_TURN_ENDED = 6;
const GAME_STATE_EVENT_MOVE_AGAIN = 7;

function gameStateInitHandleEvent(event) {
    switch (event) {
        case GAME_STATE_EVENT_INIT:
            playRingBearerFromDeck();
            gameState.player.initialized = true;
            gameState.currentState = GAME_STATE_BID_BURDENS;
            showBurdenBidPopup(true);
            break;
        default:
            console.warn("[GAMESM]:Unhandled event : %s", event);
            break;
    }
}

function gameStateDetermineStarter(playerFirst) {
    changeBurden(gameState.player.burdensBid); // Send event to set burdens, wait for receipt.
    gameState.currentState = GAME_STATE_FELLOWSHIP;

    if (gameState.opponent.burdensBid > gameState.player.burdensBid) {
        gameState.activeFellowship = OPPONENT;
    } else if (gameState.player.burdensBid > gameState.opponent.burdensBid) {
        gameState.activeFellowship = PLAYER;
    } else if (playerFirst) {
        gameState.activeFellowship = PLAYER;
    } else {
        gameState.activeFellowship = OPPONENT;
    }

    if (gameState.activeFellowship == PLAYER) {
        playSiteFromDeck(1);
    }
}

function gameStateBurdensHandleEvent(event) {
    switch (event) {
        case GAME_STATE_EVENT_BURDENS_BID:
            showBurdenBidPopup(false);
            sendBurdenBidEvent(gameState.player.burdensBid);
            //Check if opponent already bidded burdens
            if (gameState.opponent.burdensBid >= 0) {
                gameStateDetermineStarter(false);
            } else {
                gameState.currentState = GAME_STATE_AWAIT_OPPONENT_BID;
                showWaitingBurdenBidPopup(true);
            }
            break;
        default:
            console.warn("[GAMESM]:Unhandled event : %s", event);
            break;
        case GAME_STATE_EVENT_OPPONENT_BURDENS_BID:
            break;
    }
}

function gameStateAwaitOpponentBidHandleEvent(event) {
    switch (event) {
        case GAME_STATE_EVENT_OPPONENT_BURDENS_BID:
            showWaitingBurdenBidPopup(false);
            gameStateDetermineStarter(true);
            break;
        case GAME_STATE_EVENT_PHASE_FINISHED:
            showWaitingBurdenBidPopup(false);
            gameStateDetermineStarter(true);
            break;
        default:
            break;
    }
}

function gameStateFellowshipHandleEvent(event) {
    switch (event) {
        case GAME_STATE_EVENT_PHASE_FINISHED:
            if (gameState.activeFellowship == PLAYER) {
                gameState.currentState = GAME_STATE_SHADOW;
                sendPhaseFinishedEvent(gameState.currentState);
            } else {
                alert("It is not your turn, wait for opponent to finish Fellowship")
            }
            break;
        case GAME_STATE_EVENT_OPPONENT_PHASE_FINISHED:
            gameState.currentState = GAME_STATE_SHADOW;
            break;
        default:
            break;
    }
}

function gameStateShadowHandleEvent(event) {
    switch (event) {
        case GAME_STATE_EVENT_PHASE_FINISHED:
            if (gameState.activeFellowship == OPPONENT) {
                gameState.currentState = GAME_STATE_MANUEVER;
                sendPhaseFinishedEvent(gameState.currentState);
            } else {
                alert("It is not your turn, wait for opponent to finish Shadow")
            }
            break;
        case GAME_STATE_EVENT_OPPONENT_PHASE_FINISHED:
            gameState.currentState = GAME_STATE_MANUEVER;
            break;
        default:
            break;
    }
}

function gameStateManueverHandleEvent(event) {
    switch (event) {
        case GAME_STATE_EVENT_PHASE_FINISHED:
            gameState.currentState = GAME_STATE_ARCHERY;
            sendPhaseFinishedEvent(gameState.currentState);
            break;
        case GAME_STATE_EVENT_OPPONENT_PHASE_FINISHED:
            gameState.currentState = GAME_STATE_ARCHERY;
            break;
        default:
            break;
    }
}

function gameStateArcheryHandleEvent(event) {
    switch (event) {
        case GAME_STATE_EVENT_PHASE_FINISHED:
            gameState.currentState = GAME_STATE_ASSIGNMENT;
            sendPhaseFinishedEvent(gameState.currentState);
            break;
        case GAME_STATE_EVENT_OPPONENT_PHASE_FINISHED:
            gameState.currentState = GAME_STATE_ASSIGNMENT;
            break;
        default:
            break;
    }
}

function gameStateAssignmentHandleEvent(event) {
    switch (event) {
        case GAME_STATE_EVENT_PHASE_FINISHED:
            gameState.currentState = GAME_STATE_SKIRMISH;
            sendPhaseFinishedEvent(gameState.currentState);
            break;
        case GAME_STATE_EVENT_OPPONENT_PHASE_FINISHED:
            gameState.currentState = GAME_STATE_SKIRMISH;
            break;
        default:
            break;
    }
}

function gameStateSkirmishHandleEvent(event) {
    switch (event) {
        case GAME_STATE_EVENT_PHASE_FINISHED:
            gameState.currentState = GAME_STATE_REGROUP;
            sendPhaseFinishedEvent(gameState.currentState);
            break;
        case GAME_STATE_EVENT_OPPONENT_PHASE_FINISHED:
            gameState.currentState = GAME_STATE_REGROUP;
            break;
        default:
            break;
    }
}

function gameStateRegroupHandleEvent(event) {
    switch (event) {
        case GAME_STATE_EVENT_PHASE_FINISHED:
            if (gameState.activeFellowship == PLAYER) {
                showMoveAgainPrompt(true);
            } else {
                alert("It is up to other player to decide to move again")
            }
            break;
        case GAME_STATE_EVENT_MOVE_AGAIN:
            showMoveAgainPrompt(false);
            moveToNextSite(1);
            gameState.currentState = GAME_STATE_SHADOW;
            sendPhaseFinishedEvent(gameState.currentState);
            break;
        case GAME_STATE_EVENT_END_TURN:
            showMoveAgainPrompt(false);
            gameState.currentState = GAME_STATE_FELLOWSHIP;
            sendEndTurnEvent(gameState.currentState);
            gameState.activeFellowship = OPPONENT;
            break;
        case GAME_STATE_EVENT_OPPONENT_PHASE_FINISHED:
            gameState.currentState = GAME_STATE_SHADOW;
            break;
        case GAME_STATE_EVENT_OPPONENT_TURN_ENDED:
            gameState.currentState = GAME_STATE_FELLOWSHIP;
            gameState.activeFellowship = PLAYER;
            break;
        default:
            break;
    }

}


const gameStateFuncs = {
    "Init": gameStateInitHandleEvent,
    "BidBurdens": gameStateBurdensHandleEvent,
    "AwaitOpponentBid": gameStateAwaitOpponentBidHandleEvent,
    "Fellowship": gameStateFellowshipHandleEvent,
    "Shadow": gameStateShadowHandleEvent,
    "Manuever": gameStateManueverHandleEvent,
    "Archery": gameStateArcheryHandleEvent,
    "Assignment": gameStateAssignmentHandleEvent,
    "Skirmish": gameStateSkirmishHandleEvent,
    "Regroup": gameStateRegroupHandleEvent,
}

function gameStateMachine(event) {
    let currentState = gameState.currentState;
    if (gameStateFuncs[gameState.currentState]) {
        gameStateFuncs[gameState.currentState](event);
    }
    if (currentState != gameState.currentState) {
        console.log("[GAMESM] cur:%s -> next:%s on event:%s", currentState, gameState.currentState, event)
    }
}


function initGame() {
    gameStateMachine(GAME_STATE_EVENT_INIT);
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
        case GAME_EVENT_CHARACTER_INFO_CHANGED:
            handleOpponentCharacterChanged(eventData);
            break;
        case GAME_EVENT_PLAYER_MOVED:
            handlePlayerMovedEvent(eventData);
            break;
        case GAME_EVENT_BURDENS_BID:
            handleOpponentBurdensBidEvent(eventData);
            break;
        case GAME_STATE_EVENT_PHASE_FINISHED:
            handlePhaseFinishedEvent(eventData);
            break;
        case GAME_STATE_EVENT_END_TURN:
            handleEndTurnEvent(eventData);
            break;
        default:
            console.error("Unhandled gameEvent: %s", eventData.type)
            break;

    }
    Notification.showNotification(JSON.stringify(msg.detail, null, 2));
    draw();
})


document.addEventListener('gameStarted', (msg) => {
    console.log("Game has officially started")
    // Right spot?
    initGame();
})

document.addEventListener('twilightChanged', (msg) => {
    handleTwilightChanged(msg.detail)
})

function resizeCanvas() {

    const scale = window.devicePixelRatio || 1;

    // Match canvas size to display size * scale
    logical.width = canvas.clientWidth;
    logical.height = canvas.clientHeight;

    canvas.width = logical.width * scale;
    canvas.height = logical.height * scale;

    ctx.setTransform(1, 0, 0, 1, 0, 0); // Reset any existing transforms
    ctx.scale(scale, scale);

    draw();
}
window.addEventListener('resize', resizeCanvas);
window.addEventListener('load', resizeCanvas);
resizeCanvas();

// Initial draw
draw();
requestAnimationFrame(renderScene);

