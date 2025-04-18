import { initializePlayerDeck } from "./decks.js";
import * as Notification from "./notification.js";
import * as Layout from "./canvas_layout.js"

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// game event enums.
const GAME_EVENT_DECK_INIT = "deckInitialized";
const GAME_EVENT_TWILIGHT_CHANGED = "twilightChanged";
const GAME_EVENT_CHARACTER_WOUNDED = "characterWounded";
const GAME_EVENT_PLAYER_MOVED = "playerMoved";

// UI constants
const DRAG_THRESHOLD = 0.015;

// UI Globals
let logical = { width: canvas.width, height: canvas.height };

// Define  "snap area" (a target area where cards should snap when dropped)
// Game constants
const MAX_CARDS_IN_HAND = 12;
const MAX_NUMBER_COMPANIONS = 9;
const MAX_HEALTH = 6;
const MAX_BURDENS = 9;

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
    cardToPreview: null,
    siteButtons: [siteButtonLeft, siteButtonRight]
}
uiState.companionPreviewCards = new Map();


const gameState = {
    gameId: "",
    twilight: 0,

    player: {
        initialized: false,
        name: "",
        currentSite: 1,
        companions: {},
        minions: {},
    },
    opponent: {
        initialized: false,
        currentSite: 1,
        companions: {},
        minions: {},
    },

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

    globalUuidRef: 0,
}

function initCompanionSlots() {
    for (let i = 0; i < MAX_NUMBER_COMPANIONS; i++) {
        gameState.companionSlots[i] = []
        gameState.cardsInOpponentCompanionSlots[i] = []
    }
}
initCompanionSlots();


function initCard(_id, cardType, siteNum = 0) {
    gameState.globalUuidRef++;

    return {
        id: _id, /* This is the refrence picture/name of card. May be multiple instances in deck/game */
        uuid: gameState.globalUuidRef, /* unique identifier for this players instance of _id, unique per game */
        x: drawDeck.x, /* The current location of the card, may be in pile or on board*/
        y: drawDeck.y, /* ** */
        z: 0, /* unsued atm */
        width: Layout.CARD_WIDTH, /* Generally static unless a preview is made */
        height: Layout.CARD_HEIGHT, /* */
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

    const img = new Image(Layout.CARD_WIDTH, Layout.CARD_HEIGHT);
    img.src = `assets/cards/${cardId}.png`;
    cardLibrary[cardId] = img;
    return img;
}

const assetLibrary = {

}
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
    console.debug("Dispatching gameEvent: %s", JSON.stringify(event, null, 2))
    document.dispatchEvent(new CustomEvent("gameEvent", { detail: event }));
}

function sendWoundEvent(characterInfo) {
    let woundEvent = {
        type: GAME_EVENT_CHARACTER_WOUNDED,
        character: characterInfo.card.uuid,
        wounds: characterInfo.currentWounds,
        burdens: characterInfo.currentBurdens
    }
    sendGameEvent(woundEvent);
}

function sendDeckInitialized(deckSize) {
    let deckLoadedEvent = {
        type: GAME_EVENT_DECK_INIT,
        deckSize: deckSize,
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

async function initCardDeck() {
    // Load from starter deck.
    // E.g. csv.lines.forEach({cardsInDrawDeck.push(initCard(line))})
    gameState.player.name = sessionStorage.getItem("playerName")
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
        // Pre-cache all card assets here.
        // getCardImage(cardObj.cardId);
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
    const baseFontSize = 8; // original size as base
    const scale = logical.width / 800;
    const scaledFontSize = Math.round(baseFontSize * scale);

    //ctx.font = `${scaledFontSize}px "Uncial Antiqua", serif`; // Set font size and type
    ctx.font = `${scaledFontSize}px "Uncial Antiqua"`;
    ctx.fillStyle = 'black'; // Set text color
    if (centered) {
        const textWidth = ctx.measureText(text).width;
        x = x - textWidth / 2;
    }
    ctx.fillText(text, x, y); // Draw the text at position (50, 150)
}


function drawRectR(area, text = "", fillStyle = 'rgba(255, 255, 255, 0.3') {
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

    // const img = getAsset("card_placemat");
    // if (img && img.complete) {   // Make sure the image is loaded
    //     ctx.save()
    //     ctx.drawImage(img, x, y, width, height);
    //     ctx.restore();
    // }
    drawText(text, x + width / 2, y + height / 2)
}

function drawRect(area, text = "", fillStyle = 'rgba(255, 255, 255, 0.5') {
    let x = Math.round(area.x * logical.width);
    let y = Math.round(area.y * logical.height);
    let width = Math.round(area.width * logical.width);
    let height = Math.round(area.height * logical.height);

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
            offsetCard.y = card.y - Layout.CARD_PREVIEW_SHIFT;
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
    siteSlots.forEach(siteSlot => {
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
        drawActionPanel(actionPanel, gameState.player.minions[card.uuid])
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

function drawFanout() {
    let numCardsInHand = gameState.cardsInPlayerHand.length;

    for (let i = 0; i < numCardsInHand; i++) {
        ctx.save();
        let card = { ...gameState.cardsInPlayerHand[i] };
        card.x = logical.width / 2;
        card.y = logical.height / 2;
        const w = card.width * logical.width;
        const h = card.height * logical.height;
        const cw_act = Layout.CARD_WIDTH * logical.width;
        const ch_act = Layout.CARD_HEIGHT * logical.height;

        ctx.translate(card.x, card.y);
        let start = -Math.PI / 4
        ctx.rotate(start + 15 * i * (Math.PI / 180));

        console.log("Draw card translated to (%d, %d)", card.x, card.y)
        drawCardImage(card.id, i * 50, 100, w, h);
        ctx.restore();
    }
}
//
// Draw all the cards in a players hand, and if they are hovering over a card, an enlarged one.
function drawPlayerHand() {
    drawSpreadPile(gameState.cardsInPlayerHand)
}

function drawPlayerSupportCards() {
    drawSpreadPile(gameState.cardsInSupportArea)
}


function drawToken(x, y, type) {
    x = x * logical.width;
    y = y * logical.height;
    let w = Layout.TOKEN_WIDTH * logical.width;
    let h = Layout.TOKEN_HEIGHT * logical.height;

    // Draw the PNG image inside the card
    const tokenImage = getAsset(type);
    if (tokenImage) {
        if (tokenImage.complete) {   // Make sure the image is loaded
            ctx.save()
            ctx.drawImage(tokenImage, x, y, w, h);
            ctx.restore();
        }
    }

}

function drawActionPanelButton(button, asset) {
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

function drawHealthBar(origin, color, health, max = MAX_HEALTH) {
    let healthBar = {
        x: origin.x, y: origin.y,
        width: Layout.healthBarWidth, height: Layout.healthBarHeight
    };

    drawRect(healthBar, "", 'rgba(255, 255, 255, 0.0');

    for (let i = 0; i < health && i < max; i++) {
        let x = healthBar.x;
        let y = healthBar.y;
        let w = healthBar.width / max;
        let h = healthBar.height;
        drawRect({ x: x + i * w, y: y, width: w, height: h }, "", color)
    }
}

function drawActionPanel(actionPanel, companion) {
    const origin = { x: actionPanel.origin.x, y: actionPanel.origin.y }
    actionPanel.heal.x = origin.x;
    actionPanel.heal.y = origin.y - Layout.buttonHeight;
    actionPanel.wound.x = origin.x + Layout.buttonWidth;
    actionPanel.wound.y = origin.y - Layout.buttonHeight;
    actionPanel.healthBar.x = origin.x;
    actionPanel.healthBar.y = origin.y - Layout.buttonHeight - (Layout.healthBarHeight + Layout.Margin);
    actionPanel.burdenBar.x = origin.x;
    actionPanel.burdenBar.y = origin.y - Layout.buttonHeight - 2 * (Layout.healthBarHeight + Layout.Margin);

    drawActionPanelButton(actionPanel.wound, "wound_button");
    drawActionPanelButton(actionPanel.heal, "heal_button");
    drawHealthBar({ x: actionPanel.healthBar.x, y: actionPanel.healthBar.y },
        'red', companion.currentWounds);

    if (companion.card.cardType == "RingBearer") {
        drawHealthBar({ x: actionPanel.burdenBar.x, y: actionPanel.burdenBar.y }
            , 'white', companion.currentBurdens, MAX_BURDENS)
    }
}

function drawCompanionActionPanels() {
    Object.entries(gameState.player.companions).forEach(([id, companion]) => {
        if (companion) {
            drawActionPanel(companion.actionPanel, companion)
        }
    })
}


function drawOpponentActionPanel(companion) {
    let origin = { x: companion.card.x, y: companion.card.y + Layout.CARD_HEIGHT + Layout.Margin }
    drawHealthBar(origin, 'red', companion.currentWounds);

    if (companion.card.cardType == "RingBearer") {
        origin.y = origin.y + (Layout.healthBarHeight + Layout.Margin);
        drawHealthBar(origin, 'white', companion.currentBurdens);
    }
}

function drawCompanionSlot(slot) {
    let companionSlot = gameState.companionSlots[slot];

    // Draw all the cards.
    companionSlot.forEach(card => {
        drawCardWithPreview(card);
    });
}

function drawPlayerCompanionCards() {
    // cardsInCompanionSlots should be "slots", and each have sub attachments.
    for (let i = 0; i < MAX_NUMBER_COMPANIONS; i++) {
        if (gameState.companionSlots[i]) {
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

// Draw stack.
function drawDrawDeck() {
    let numCardsInDrawDeck = gameState.cardsInDrawDeck.length
    if (numCardsInDrawDeck > 0) {
        for (let i = 0; i < numCardsInDrawDeck; i++) {
            gameState.cardsInDrawDeck[i].x = drawDeck.x + Layout.DRAW_DECK_SHIFT * Math.floor(Math.sqrt(i));
            drawCardReverse(gameState.cardsInDrawDeck[i])
        }
    }
}

function drawBackground() {
    ctx.clearRect(0, 0, logical.width, logical.height); // Clear the canvas
    if (backgroundImage.complete) {
        ctx.drawImage(backgroundImage, 0, 0, logical.width, logical.height);
    }
}


function drawDeadPile() {
    let numCardsInDeadPile = gameState.cardsInPlayerDeadPile.length
    if (numCardsInDeadPile > 0) {
        let card = gameState.cardsInPlayerDeadPile[numCardsInDeadPile - 1];
        drawCardRotated(card, 90);
        if (isMouseOverCardRotated(card)) {
            uiState.cardToPreview = card;
        }
    }
}

function drawCompanionZones() {
    for (let i = 0; i < MAX_NUMBER_COMPANIONS; i++) {
        const rect = {
            x: companionZone.x + i * (Layout.CARD_WIDTH + 2 * Layout.Margin), y: companionZone.y,
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
        drawOpponentActionPanel(gameState.opponent.minions[card.uuid]);
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
            gameState.cardsInOpponentDrawDeck[i].x = opponentDeck.x + Layout.DRAW_DECK_SHIFT * Math.floor(Math.sqrt(i));
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
            drawOpponentActionPanel(gameState.opponent.companions[card.uuid])
        }
    }
}

function drawOpponentCompanionCards() {
    for (let i = 0; i < MAX_NUMBER_COMPANIONS; i++) {
        let offset = { x: opponentCompanionZone.x + i * (Layout.CARD_WIDTH + 2 * Layout.Margin), y: opponentCompanionZone.y }
        drawOpponentCompanionSlot(gameState.cardsInOpponentCompanionSlots[i], offset, i);
    }

}

function drawOpponentSupportCards() {
    let i = 0;
    gameState.cardsInOpponentSupportArea.forEach(card => {
        card.x = opponentSupportZone.x + Layout.PLAYER_HAND_OFFSET * i;
        card.y = opponentSupportZone.y;
        i++;
        drawCardWithPreview(card);
    });
}

function drawOpponentCompanionZones() {
    for (let i = 0; i < MAX_NUMBER_COMPANIONS; i++) {
        const rect = {
            x: opponentCompanionZone.x + i * (Layout.CARD_WIDTH + 2 * Layout.Margin), y: opponentCompanionZone.y,
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
    drawOpponentCompanionZones(opponentCompanionZone, "Companion");
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
        if (uiState.cardToPreview.cardType === "Site") {
            drawCardPreviewRotated(uiState.cardToPreview);
        } else {
            drawCardPreview(uiState.cardToPreview)
        }
        uiState.cardToPreview = null
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

function drawSiteToken(asset, site, offset) {
    site = Math.min(9, site);
    let x = Layout.siteSlots[site - 1].x - 2 * Layout.Margin;
    let y = Layout.siteSlots[site - 1].y + offset * (Layout.CARD_WIDTH / 3);
    drawToken(x, y, asset);
}

function drawSiteTokens() {
    drawSiteToken("burden", gameState.player.currentSite, 0);
    drawSiteToken("wound", gameState.opponent.currentSite, 1);
}

function drawAllCards() {
    // Draw background image (TODO change each game or add option to change.)
    ctx.save(); // Save the current context state

    //ctx.transform(1, 0, 0.0,Math.sin(t/360),0, 0)

    drawBackground();

    drawStaticSnapZones();
    drawOpponentArea();

    drawOpponentCards();
    drawPlayerCards();

    // sites.
    drawSiteCards();
    drawOpponentSiteCards();

    drawSiteTokens();
    drawPopups();

    ctx.restore();
}

function renderScene() {
    t += 1;
    if (uiState.cardsDirty) {
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
const CARD_EVENT_LOCATION_DEAD_PILE = "playerDeadPile";
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

    // Reshuffle/organize playerhand
    for (let i = numCardsInHand; i >= 0; i--) {
        let card = gameState.cardsInPlayerHand[i];
        card.x = playerHand.x + i * Layout.PLAYER_HAND_OFFSET;
        card.y = playerHand.y;
    }
    sendCardMovedEvent(from, CARD_EVENT_LOCATION_PLAYER_HAND, card);
    return true;
}

function initMinion(card) {
    let minionInfo = {
        card: card,
        currentWounds: 0,
    }

    createActionPanel(minionInfo);
    gameState.player.minions[card.uuid] = minionInfo;
}

function handleMinionPlayed(card) {
    if (gameState.player.minions[card.uuid]) {
        console.log("Minion already active,nothing to do");
    } else {
        initMinion(card);
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
function placeCardInDiscard(from, card) {
    console.log("Discarding card id:%s", card.id)

    gameState.cardsInPlayerDiscard.push(card)

    card.x = discardPile.x;
    card.y = discardPile.y;

    sendCardMovedEvent(from, CARD_EVENT_LOCATION_DISCARD, card);

    removeMinionFromPlay(card);
    return true;
}

function removeCompanionFromPlay(card) {
    if (gameState.player.companions[card.uuid]) {
        gameState.player.companions[card.uuid] = null;
    }
}


function placeCardInDeadPile(from, card) {
    console.log("Adding card to dead pile id:%s", card.id)

    gameState.cardsInPlayerDeadPile.push(card)

    card.x = deadPile.x
    card.y = deadPile.y

    sendCardMovedEvent(from, CARD_EVENT_LOCATION_DEAD_PILE, card);

    // remove activeCompanionInformation.
    removeCompanionFromPlay(card);
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

    sendCardMovedEvent(from, CARD_EVENT_LOCATION_SUPPORT_AREA, card);
    return true;
}

function cardIsCompanionType(card) {
    return card.cardType == "Companion" || card.cardType == "RingBearer"
}

function restackCompanionSlot(slotNum) {
    const slotOrigin = { x: companionZone.x + slotNum * (Layout.CARD_WIDTH + 2 * Layout.Margin), y: companionZone.y }
    const companionSlot = gameState.companionSlots[slotNum];
    const numCardsInSlot = companionSlot.length;
    let offset = 0;
    let i = 0;

    for (i = 0; i < gameState.companionSlots[slotNum].length; i++) {
        let card = gameState.companionSlots[slotNum][i];
        if (cardIsCompanionType(card)) {
            // update buttons while we are here.
            let actionPanel = gameState.player.companions[card.uuid].actionPanel;
            // TODO just update the actionPanel origin, and draw/monitor events from that offset.
            actionPanel.origin.x = slotOrigin.x;
            actionPanel.origin.y = slotOrigin.y;
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
            sendWoundEvent(characterInfo);
        }
    }

    let woundButton = {
        x: card.x + Layout.buttonWidth, y: card.y - Layout.Margin,
        width: Layout.buttonWidth, height: Layout.buttonHeight, label: "Wound",
        callback: () => {
            characterInfo.currentWounds = Math.min(MAX_HEALTH, characterInfo.currentWounds + 1);
            sendWoundEvent(characterInfo);
        }
    }

    let healthBar = {
        x: woundButton.x, y: woundButton.y - (Layout.healthBarHeight + Layout.Margin),
        width: Layout.healthBarWidth, height: Layout.healthBarHeight
    }

    let burdenBar = {
        x: healthBar.x, y: healthBar.y - (Layout.healthBarHeight + Layout.Margin),
        width: Layout.healthBarWidth, height: Layout.healthBarHeight
    }
    // TODO strength boost bar.
    // let strength go + or -.

    let actionPanel = {
        origin: { x: card.x, y: card.y },
        wound: woundButton,
        heal: healButton,
        healthBar: healthBar,
        burdenBar: burdenBar,
    }

    characterInfo.actionPanel = actionPanel;
}

function initializeCompanion(card, slotNum) {
    let companionInfo = {
        card: card,
        currentWounds: 0,
        currentBurdens: 0,
        homeSlot: slotNum
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
    let companionSlot = gameState.companionSlots[slotNum];
    let companionSlotOccupied = slotHasCompanion(companionSlot);
    let cardIsCompanion = cardIsCompanionType(card);

    console.log("Placing card : %s in companion slot: %d", JSON.stringify(card, 2, null), slotNum);

    if (companionSlotOccupied == false) {
        if (cardIsCompanion == false) {
            console.error("Cannot place non-companion in companion slot first");
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
            return true;
        }
    }
    return false;
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
                placeCardInHand(CARD_EVENT_LOCATION_DISCARD, selectedCard);
                return true;
            }
        }
    }
    return false;
}

function checkCardTapped() {
    handleCompanionPreviewTapped();
    handleDrawDeckTapped();
    handleSiteSlotTapped();
    handleDiscardCardTapped();
}


function checkCardReleased(fromPile, pile) {
    for (let i = pile.length - 1; i >= 0; i--) {
        let card = pile[i];
        if (card === uiState.activelySelectedCard) {
            console.log("Removing a card and handling it generically");
            const selectedCard = pile.splice(i, 1)[0];
            handleGenericCardMoved(fromPile, selectedCard);
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
                placeCardInHand(CARD_EVENT_LOCATION_PLAYER_HAND, pulledCard);
            } else {
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
        let pulledCard = removeCardFromDeck(targetCard);
        if (pulledCard) {
            placeCardInFreeCompanionSlot("playerDeck", pulledCard);
        } else {
            console.error("Could not find card in draw decK??");
        }
    }
}


function handleSiteSlotTapped() {
    for (let i = 0; i < siteSlots.length; i++) {
        if (isMouseOverCard(siteSlots[i])) {
            return playSiteFromDeck(i + 1);
        }
    }
    return false;
}

function handleCompanionCardsReleased(tapped) {
    let i = 0;
    gameState.companionSlots.forEach(slot => {
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
        { name: CARD_EVENT_LOCATION_DEAD_PILE, pile: gameState.cardsInPlayerDeadPile },
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
function checkButtonsClicked() {
 
    Object.entries(gameState.player.companions).forEach(([id, companion]) => {
        if (companion && companion.actionPanel) {
            checkButtonClicked(companion.actionPanel.wound);
            checkButtonClicked(companion.actionPanel.heal);
        }
    })
    Object.entries(gameState.player.minions).forEach(([id, minion]) => {
        if (minion && minion.actionPanel) {
            checkButtonClicked(minion.actionPanel.wound);
            checkButtonClicked(minion.actionPanel.heal);
        }
    })
    uiState.siteButtons.forEach(button => {
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

function mouseOverButton(btn) {
    return uiState.mouseX >= btn.x && uiState.mouseX <= btn.x + btn.width &&
        uiState.mouseY >= btn.y && uiState.mouseY <= btn.y + btn.height
}
function checkButtonHover() {
    let hovering = false;

    Object.entries(gameState.player.companions).forEach(([id, companion]) => {
        if (companion) {
            let actionPanel = companion.actionPanel;
            for (const btn of [actionPanel.wound, actionPanel.heal]) {
                if (mouseOverButton(btn)) {
                    hovering = true;
                    break;
                }
            }
        }
    });

    Object.entries(gameState.player.minions).forEach(([id, minion]) => {
        if (minion) {
            let actionPanel = minion.actionPanel;
            for (const btn of [actionPanel.wound, actionPanel.heal]) {
                if (mouseOverButton(btn)) {
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
    canvas.style.cursor = hovering ? 'pointer' : 'default';
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
        console.log("Moving existing card (%d)", existingCard.uuid)
        existingCard.x = eventData.position.x;
        existingCard.y = eventData.position.y;
        toPile.push(existingCard);
    } else {
        console.log("New card played")

        let card = initCard(eventData.cardId, eventData.cardType);
        card.uuid = eventData.cardUuid; // override uuid generated ref.
        card.x = eventData.position.x;
        card.y = eventData.position.y;
        toPile.push(card);
    }
}

function initializeOpponentCompanion(card, slotNum) {
    let companionInfo = {
        card: card,
        currentWounds: 0,
        currentBurdens: 0,
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
    }
    console.log("Creating Opponent Minion Info :%s", JSON.stringify(minionInfo, 2, null));
    gameState.opponent.minions[card.uuid] = minionInfo;
}

function updateOpponentMinionInfo(card) {
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

function handleRemotePlayerDeadPile(eventData) {
    commonRemoteCardAction(eventData, gameState.cardsInOpponentDeadPile)
}

function handleRemotePlayerCompanionArea(eventData) {
    commonRemoteCardAction(eventData, gameState.cardsInOpponentCompanionSlots[eventData.index]);
    updateOpponentCompanionInfo(eventData);
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

function moveToNextSite(delta) {
    console.log("Move to next site :%d", delta)
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
            companion.currentBurdens = Math.max(0, (Math.min(9, companion.currentBurdens + delta)));
            document.getElementById("burdenCounter").textContent = companion.currentBurdens;
            sendWoundEvent(companion);
        }
    });

    draw();
}

document.getElementById("burdenUp").addEventListener("click", () => {
    changeBurden(1)
});

document.getElementById("burdenDown").addEventListener("click", () => {
    changeBurden(-1)
});


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
}

function handleTwilightChanged(eventData) {
    document.getElementById("twlightCounter").textContent = parseInt(eventData.twilight);
    gameState.twilight = parseInt(eventData.twilight);
}

function handleOpponentCharacterWounded(eventData) {
    let woundEvent = eventData;

    if (gameState.opponent.companions[woundEvent.character]) {
        gameState.opponent.companions[woundEvent.character].currentWounds = eventData.wounds;
        gameState.opponent.companions[woundEvent.character].currentBurdens = eventData.burdens;
    } else if (gameState.opponent.minions[woundEvent.character]) {
        gameState.opponent.minions[woundEvent.character].currentWounds = eventData.wounds;
        gameState.opponent.minions[woundEvent.character].currentBurdens = eventData.burdens;
    } else {
        console.error("Got wound event for character %s, which does not exist yet?", woundEvent.character)
    }
}

function handlePlayerMovedEvent(eventData) {
    gameState.opponent.currentSite = eventData.site;
    draw();
}

function initGame() {
    if (gameState.player.initialized == false) {
        playRingBearerFromDeck();
        gameState.player.initialized = true;
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
        case GAME_EVENT_CHARACTER_WOUNDED:
            handleOpponentCharacterWounded(eventData);
            break;
        case GAME_EVENT_PLAYER_MOVED:
            handlePlayerMovedEvent(eventData);
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

