import { LOTR_STARTER_DECK_ARAGORN } from "./decks.js";

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

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

const CARD_HEIGHT = 994 / 5;
const CARD_WIDTH = 714 / 5;

const SITE_CARD_HEIGHT = 714 / 6;
const SITE_CARD_WIDTH = 994 / 6;

const PLAYER_HAND_OFFSET = 50;
const CARD_PREVIEW_SHIFT = 20;
const CARD_PREVIEW_SCALE_FACTOR = 3.0;

// Define the "snap area" (a target area where cards should snap when dropped)
const playerHand = {
    x: canvas.width * 0.05, y: canvas.height - CARD_HEIGHT - 30,
    width: canvas.width / 2, height: CARD_HEIGHT
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

const siteSlot = {
    x: 0, y: 0,
    width: CARD_HEIGHT, height: CARD_WIDTH
}

const siteSlots = [];
for (let i = 0; i < 9; i++) {
    siteSlots.push({
        x: deadPile.x + CARD_HEIGHT + 20,
        y: canvas.height * 0.025 + ((SITE_CARD_HEIGHT + 5) * i),
        width: SITE_CARD_WIDTH, height: SITE_CARD_HEIGHT
    });
}

// Card object structure, top of cards is "top of stack"

const gameState = {
    dragActive: false,
    allCards: [],
    cardsInPlayerHand: [],
    cardsInPlayerDiscard: [],
    cardsInSiteSlots: [],
    cardsInPlayerDeadPile: [],
    cardsInDrawDeck: []
}

function initCard(_id) {
    return {
        id: _id,
        x: drawDeck.x,
        y: drawDeck.y,
        z: 0,
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        isDragged: false,
        isHover: false
    }
}

function initCardDeck() {
    // Load from starter deck.
    // E.g. csv.lines.forEach({cardsInDrawDeck.push(initCard(line))})
    LOTR_STARTER_DECK_ARAGORN.forEach(cardId => {
        gameState.cardsInDrawDeck.push(initCard(cardId));
    })
}

initCardDeck()

// ============================================================
// Card Management, needs events to me sent back to server.
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
function sendCardMovedEvent(msg) {
    console.log("Dispatching cardMovedEvent: %s", msg)
    document.dispatchEvent(new CustomEvent("cardEvent", { detail: msg }));
}

function placeCardInHand(card) {
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

    sendCardMovedEvent(`Card Placed in Hand {card.id}`)
}

function placeCardOnPlayArea(card) {
    console.log("Removing card %s from hand", card.id)
    gameState.allCards.push(card)

    sendCardMovedEvent("Card Removed from Hand" + card.id)
}

function placeCardInDiscard(card) {
    console.log("Discarding card id:%s", card.id)

    gameState.cardsInPlayerDiscard.push(card)

    card.x = discardPile.x;
    card.y = discardPile.y;

    sendCardMovedEvent("Card Placed in Discard:" + card.id)
}

function placeCardInDeadPile(card) {
    console.log("Adding card to dead pile")

    gameState.cardsInPlayerDeadPile.push(card)

    card.x = deadPile.x
    card.y = deadPile.y

    sendCardMovedEvent("Card Placed in DeadPile:" + card.id)
}

function placeCardAtSite(siteNum, card) {
    console.log("Adding card to site :%d", siteNum)

    if (siteNum < siteSlots.length) {
        if (gameState.cardsInSiteSlots[siteNum]) {
            console.log("Card already exists at site: %d", siteNum + 1)
        } else {
            gameState.cardsInSiteSlots[siteNum] = card;
            card.x = siteSlots[siteNum].x
            card.y = siteSlots[siteNum].y

            let str = "Card placed at siteNum: " + (siteNum+1) + " cardid:" + card.id
            sendCardMovedEvent(str)
            return true
        }
    }
    return false
}


// ============================================================
// Game board drawing code (probably needs to be react.js 'ified.)
// ============================================================

// Generic drawing of black text
function drawText(text, x, y, centered= true) {
    ctx.font = '10px "Uncial Antiqua", cursive'; // Set font size and type
    ctx.fillStyle = 'black'; // Set text color
    if (centered) {
        const textWidth = ctx.measureText(text).width;
        x =  x - textWidth / 2;
    }
    ctx.fillText(text, x, y); // Draw the text at position (50, 150)
}

// Card text is against black background, so draw white (if applicable)
function drawCardText(text, x, y) {
    ctx.font = '10px "Uncial Antiqua", cursive'; // Set font size and type
    ctx.fillStyle = 'white'; // Set text color
    ctx.fillText(text, x, y); // Draw the text at position (50, 150)
}


// Draw the actual card based on its position/motion/animation info.
function drawCard(card) {
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
                ctx.shadowColor = 'white';
                ctx.shadowBlur = 20;
            }
            ctx.drawImage(cardImage, card.x, card.y, card.width, card.height);
            ctx.restore();
        }
    }
    // let cardText = "Card id:" + card.id
    // drawCardText(cardText, card.x + CARD_WIDTH, card.y + card.height / 2 + 16)
}

function drawCardRotated(card, angle) {
    const cardImage = getCardImage(card.id)
    if (cardImage) {
        if (cardImage.complete) {

            ctx.save();
            ctx.fillStyle = card.isDragged ? 'rgba(0, 0, 0, 0.5)' : 'rgba(0, 0, 0, 1.0)';
            ctx.translate(card.x, card.y); // set rotation point.
            ctx.rotate(angle * (Math.PI / 180)); // Convert degrees to radians

            ctx.fillRect(card.x, card.y, card.width, card.height);
            ctx.strokeRect(card.x, card.y, card.width, card.height);
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
function drawCardPreview(card) {
    let cardPreview = { ...card };
    cardPreview.width *= CARD_PREVIEW_SCALE_FACTOR;
    cardPreview.height *= CARD_PREVIEW_SCALE_FACTOR;
    cardPreview.y = cardPreview.y - cardPreview.height - 5;
    drawCard(cardPreview)
}

// Draw all "loose leaf" cards on the table.
function drawCards() {
    // Draw the cards
    gameState.allCards.forEach(card => {
        if (card.isHover) {
            drawCard(card)
            drawCardPreview(card)
        } else {
            drawCard(card);
        }
    });
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

function drawDiscardPileBorder() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5';
    ctx.fillRect(discardPile.x, discardPile.y, discardPile.width, discardPile.height);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(discardPile.x, discardPile.y, discardPile.width, discardPile.height);

    drawText("DISCARD", discardPile.x + discardPile.width / 2, discardPile.y + discardPile.height / 2)
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

// Yes... draw the "Draw" deck.. TODO, rename draw->  render?
function drawDrawDeckBorder() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5';
    ctx.fillRect(drawDeck.x, drawDeck.y, drawDeck.width, drawDeck.height);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(drawDeck.x, drawDeck.y, drawDeck.width, drawDeck.height);

    drawText("DRAW EMPTY", drawDeck.x + drawDeck.width /2, drawDeck.y + drawDeck.height / 2)
}

function drawDrawDeck() {
    let numCardsInDrawDeck = gameState.cardsInDrawDeck.length
    if (numCardsInDrawDeck > 0) {
        for (let i = 0; i < numCardsInDrawDeck; i++) {
            gameState.cardsInDrawDeck[i].x = drawDeck.x + Math.floor(Math.sqrt(i))*2;
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
        drawText(siteName, siteSlot.x + siteSlot.width /2, siteSlot.y + siteSlot.height/2);
    })
}

function drawDeadPileBorder() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5';
    ctx.fillRect(deadPile.x, deadPile.y, deadPile.width, deadPile.height);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(deadPile.x, deadPile.y, deadPile.width, deadPile.height);

    drawText("DEADPILE", deadPile.x + deadPile.width /2, deadPile.y + deadPile.height / 2)
}

function drawDeadPile() {
    let numCardsInDeadPile = gameState.cardsInPlayerDeadPile.length
    if (numCardsInDeadPile > 0) {
        drawCardRotated(gameState.cardsInPlayerDeadPile[numCardsInDeadPile - 1], 90)
    }
}

function drawSiteCard(card) {
    let siteCard = {...card}
    siteCard.width = SITE_CARD_HEIGHT;
    siteCard.height = SITE_CARD_WIDTH;
    drawCardRotated(siteCard, 90)
    if (siteCard.isHover) {
        drawCardPreview(siteCard )
    }
}

function drawSiteCards() {
    for (let i = 0; i < gameState.cardsInSiteSlots.length; i++) {
        if (gameState.cardsInSiteSlots[i]) {
            drawSiteCard(gameState.cardsInSiteSlots[i])
        }
    }
}


function draw() {
    // Draw background image (TODO change each game or add option to change.)
    drawBackground();
    // Draw static images.
    //    drawPlayerHandBorder()

    drawPlayerHandGradient();
    drawDiscardPileBorder();
    drawDrawDeckBorder();
    drawSiteBorders();
    drawDeadPileBorder();

    // Draw floating cards.
    drawCards()
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

    for (let i = gameState.allCards.length - 1; i >= 0; i--) {
        let card = gameState.allCards[i]
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
        gameState.allCards.forEach(card => {
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
    gameState.allCards.forEach(card => {
        card.isHover = false;
    });
    gameState.cardsInSiteSlots.forEach(card => {
        if (card) { card.isHover = false; }
    });

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

        for (let i = gameState.allCards.length - 1; i >= 0; i--) {
            let card = gameState.allCards[i];
            if (isMouseOverCard(card)) {
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
    }
    draw();
});

function cardInSnapArea(snapArea) {
    return mouseX >= snapArea.x && mouseX <= snapArea.x + snapArea.width &&
        mouseY >= snapArea.y && mouseY <= snapArea.y + snapArea.height;
}

function handleSitePlacement(card) {
    for (let i = 0; i < siteSlots.length; i++) {
        let site = siteSlots[i]
        if (cardInSnapArea(site)) {
            return placeCardAtSite(i, card);
        }
    }
    console.log("Did not find site, returning")
    return false
}

function handleGenericCardMoved(selectedCard) {
    // Generic handler for moving/playing cards.
    if (cardInSnapArea(playerHand)) {
        placeCardInHand(selectedCard)
    } else if (cardInSnapArea(discardPile)) {
        placeCardInDiscard(selectedCard)
    } else if (cardInSnapArea(deadPile)) {
        placeCardInDeadPile(selectedCard)
    } else if (handleSitePlacement(selectedCard)) {
        console.log("Site place handled")
    } else {
        placeCardOnPlayArea(selectedCard);
    }
    selectedCard.isDragged = false;
    gameState.dragActive = false;
}

function handleFreeCardMoved() {
    // Check to see if the card moved from the board "canvas" into hand.
    for (let i = gameState.allCards.length - 1; i >= 0; i--) {
        let card = gameState.allCards[i];
        if (card.isDragged) {
            const selectedCard = gameState.allCards.splice(i, 1)[0]; // Remove card from array
            // Snap to the target area if it's close enough
            handleGenericCardMoved(selectedCard)
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
            handleGenericCardMoved(selectedCard)
            break;
        }
    }
}

// Cards from deck immediately go into player Hand.
function handleDrawDeckRelease() {
    if (gameState.cardsInDrawDeck.length > 0) {
        console.log("Checking mouse up on draw deck")
        if (isMouseOverCard(gameState.cardsInDrawDeck[gameState.cardsInDrawDeck.length-1])) {
            console.log("Use clicked on draw deck")
            let randomIndex = Math.floor(Math.random() * gameState.cardsInDrawDeck.length);
            const pulledCard = gameState.cardsInDrawDeck.splice(randomIndex, 1)[0];
            placeCardInHand(pulledCard);
        }
    }
}

function handleDiscardRelease() {
    if (gameState.cardsInPlayerDiscard.length > 0) {
        let card = gameState.cardsInPlayerDiscard[gameState.cardsInPlayerDiscard.length - 1]
        if (card.isDragged) {
            const selectedCard = gameState.cardsInPlayerDiscard.pop();
            handleGenericCardMoved(selectedCard);
        }
    }
}

function handleDeadPileRelease() {
    if (gameState.cardsInPlayerDeadPile.length > 0) {
        let card = gameState.cardsInPlayerDeadPile[gameState.cardsInPlayerDeadPile.length - 1]
        if (card.isDragged) {
            const selectedCard = gameState.cardsInPlayerDeadPile.pop();
            handleGenericCardMoved(selectedCard)
        }
    }
}

function handleSiteSlotsRelease() {

    for (let i = 0; i < gameState.cardsInSiteSlots.length; i++) {
        let card = gameState.cardsInSiteSlots[i];
        if (card && card.isDragged) {
            handleGenericCardMoved(card);
            gameState.cardsInSiteSlots[i] = null;
            break;
        }
    }
}
// Handle mouse up event to stop dragging and snap the card
canvas.addEventListener('mouseup', () => {
    // Modifying cards while looping through it?? ehh..
    handleFreeCardMoved()
    handlePlayerCardMoved()
    handleDrawDeckRelease()
    handleDiscardRelease()
    handleDeadPileRelease()
    handleSiteSlotsRelease()

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
    moveStackToDrawDeck(gameState.allCards)
    moveStackToDrawDeck(gameState.cardsInPlayerHand)
    moveStackToDrawDeck(gameState.cardsInPlayerDiscard)
    moveStackToDrawDeck(gameState.cardsInPlayerDeadPile)
}

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
        gameState.allCards.push(newCard);
    }
    draw();
})

document.addEventListener('playerJoined', (msg) => {
    console.log("canvas: Player joined")
    // Create/ show opposing players info.
})


// Initial draw
draw();
