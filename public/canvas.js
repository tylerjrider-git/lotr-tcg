const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const gameState = {
    dragActive: false
}

// Assets
backgroundImage = new Image();
backgroundImage.src = 'assets/background.jpeg'
const cardLibrary = {
    "lotr01075": new Image(),
    "lotr01000": new Image(),
    "lotrbackground": new Image(),
}
cardLibrary["lotr01000"].src = 'assets/Nora.png';
cardLibrary["lotr01075"].src = 'assets/lotr01075.jpg';
cardLibrary["lotrbackground"].src = 'assets/Lotrbackground.png'



// Track mouse position
let mouseX = 0;
let mouseY = 0;

const CARD_HEIGHT = 150;
const CARD_WIDTH = 100;
const PLAYER_HAND_OFFSET = 50

// Define the "snap area" (a target area where cards should snap when dropped)
const playerHand = {
    x: canvas.width / 4, y: canvas.height - CARD_HEIGHT - 20,
    width: canvas.width / 2, height: CARD_HEIGHT
}

// Define the "snap area" (a target area where cards should snap when dropped)
const discardPile = {
    x: canvas.width - CARD_WIDTH - 40, y: canvas.height - CARD_HEIGHT - 20,
    width: CARD_WIDTH, height: CARD_HEIGHT
}

const drawDeck = {
    x: discardPile.x - CARD_WIDTH - 10, y: canvas.height - CARD_HEIGHT - 20,
    width: CARD_WIDTH, height: CARD_HEIGHT
}

// Card object structure, top of cards is "top of stack"

const allCards = [

];

const cardsInPlayerHand = [
]

const cardsInPlayerDiscard = [
]

const cardsInDrawDeck = [
    { id: "lotr01000", x: drawDeck.x, y: drawDeck.y, z: 0, width: CARD_WIDTH, height: CARD_HEIGHT, isDragged: false, isHover: false },
    { id: "lotr01075", x: drawDeck.x, y: drawDeck.y, z: 0, width: CARD_WIDTH, height: CARD_HEIGHT, isDragged: false, isHover: false },
    { id: "lotr01000", x: drawDeck.x, y: drawDeck.y, z: 0, width: CARD_WIDTH, height: CARD_HEIGHT, isDragged: false, isHover: false },
    { id: "lotr01075", x: drawDeck.x, y: drawDeck.y, z: 0, width: CARD_WIDTH, height: CARD_HEIGHT, isDragged: false, isHover: false },
]


// ============================================================
// Card Management, needs events to me sent back to server.
// ============================================================
function placeCardInHand(card) {
    console.log("Placing %s into hand", card.id)

    // Snap to end of hand location
    let numCardsInHand = cardsInPlayerHand.length;

    card.x = playerHand.x + numCardsInHand * PLAYER_HAND_OFFSET;
    card.y = playerHand.y;

    cardsInPlayerHand.push(card)
}

function removeCardFromHand(card) {
    console.log("Removing card %s from hand", card.id)

    allCards.push(card)
}

function placeCardInDiscard(card) {
    console.log("Discarding card id:%s", card.id)

    cardsInPlayerDiscard.push(card)

    card.x = discardPile.x;
    card.y = discardPile.y;
}

// ============================================================
// Game board drawing code
// ============================================================

// Generic drawing of black text
function drawText(text, x, y) {
    ctx.font = '10px Arial'; // Set font size and type
    ctx.fillStyle = 'black'; // Set text color
    ctx.fillText(text, x, y); // Draw the text at position (50, 150)
}

// Card text is against black background, so draw white (if applicable)
function drawCardText(text, x, y) {
    ctx.font = '10px Arial'; // Set font size and type
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
    if (cardLibrary[card.id]) {
        const cardImage = cardLibrary[card.id]
        if (cardImage.complete) {   // Make sure the image is loaded
            ctx.drawImage(cardImage, card.x, card.y, card.width, card.height);
        }
    }

    let cardText = "Card id:" + card.id
    drawCardText(cardText, card.x + CARD_WIDTH, card.y + card.height / 2 + 16)
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
    cardPreview.width *= 1.8;
    cardPreview.height *= 1.8;
    cardPreview.y = cardPreview.y - cardPreview.height - 5;
    drawCard(cardPreview)
}

// Draw all "loose leaf" cards on the table.
function drawCards() {
    // Draw the cards
    allCards.forEach(card => {
        drawCard(card)
    });
}

// Draw the players hand region
function drawPlayerHandBorder() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5';
    ctx.fillRect(playerHand.x, playerHand.y, playerHand.width, playerHand.height);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(playerHand.x, playerHand.y, playerHand.width, playerHand.height);
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
    cardsInPlayerHand.forEach(card => {

        if (card.isHover) {
            let offsetCard = { ...card }
            offsetCard.y = card.y - 50
            drawCard(offsetCard)
            drawCardPreview(offsetCard)
        } else {
            drawCard(card);
        }
        // If mouse is hovering over a card in the player hand enlarge it.
    });

    drawText("Number of Cards in Hand : " + cardsInPlayerHand.length, playerHand.x, playerHand.y + CARD_HEIGHT)
}

function drawDiscardPileBorder() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5';
    ctx.fillRect(discardPile.x, discardPile.y, discardPile.width, discardPile.height);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(discardPile.x, discardPile.y, discardPile.width, discardPile.height);

    drawText("DISCARD", discardPile.x + 25, discardPile.y + discardPile.height/2)
}

function drawDiscardPile() {
    let numCardsInDiscard = cardsInPlayerDiscard.length
    if (numCardsInDiscard > 0) {
        drawCard(cardsInPlayerDiscard[numCardsInDiscard - 1])

        if (cardsInPlayerDiscard[numCardsInDiscard - 1]) {
            //console.log("Need to draw a hover of the discard")
            // TODO
        }
    }
}

// Yes... draw the "Draw" deck.. TODO, rename draw->  render?
function drawDrawDeckBorder() {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5';
    ctx.fillRect(drawDeck.x, drawDeck.y, drawDeck.width, drawDeck.height);
    ctx.strokeStyle = '#000';
    ctx.strokeRect(drawDeck.x, drawDeck.y, drawDeck.width, drawDeck.height);

    drawText("DRAW EMPTY", drawDeck.x + 15, drawDeck.y + drawDeck.height/2)
}

function drawDrawDeck() {
    let numCardsInDrawDeck = cardsInDrawDeck.length
    if (numCardsInDrawDeck > 0) {
        for(let i = 0; i < numCardsInDrawDeck; i++) {
            cardsInDrawDeck[i].x = drawDeck.x + i*2;
            drawCardReverse(cardsInDrawDeck[i])
        }
    }

}

function drawBackground() {
    ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear the canvas
    if (backgroundImage.complete) {
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    }
}

function draw() {
    // Draw background image (TODO change each game or add option to change.)
    drawBackground();
    // Draw static images.
    //    drawPlayerHandBorder()
    drawPlayerHandGradient()
    drawDiscardPileBorder()
    drawDrawDeckBorder()

    // Draw floating cards.
    drawCards()
    // Draw cards in the hand.
    drawPlayerHand()
    // Draw top of discard
    drawDiscardPile()
    // Draw deck
    drawDrawDeck()
}

// ============================================================
// Interaction management / gen UI.
// ============================================================
// Check if the mouse is over a card
function isMouseOverCard(card) {
    return mouseX >= card.x && mouseX <= card.x + card.width &&
        mouseY >= card.y && mouseY <= card.y + card.height;
}

// Handle mouse down event to start dragging a card
canvas.addEventListener('mousedown', (e) => {
    mouseX = e.offsetX;
    mouseY = e.offsetY;

    for (let i = allCards.length - 1; i >= 0; i--) {
        let card = allCards[i]
        if (isMouseOverCard(card)) {
            card.isDragged = true;
            gameState.dragActive = true;
            console.log("mousedown event for card %d (id:%d)", i, card.id)
            break;
        }
    }

    for (let i = cardsInPlayerHand.length - 1; i >= 0; i--) {
        let card = cardsInPlayerHand[i]
        if (isMouseOverCard(card)) {
            card.isDragged = true;
            gameState.dragActive = true;
            console.log("mousedown event for %d", card.id)
            break;
        }
    };
});

// Handle mouse move event to drag the card
canvas.addEventListener('mousemove', (e) => {
    mouseX = e.offsetX;
    mouseY = e.offsetY;

    // Draw drag movement.
    if (gameState.dragActive) {
        allCards.forEach(card => {
            if (card.isDragged) {
                card.x = mouseX - card.width / 2;
                card.y = mouseY - card.height / 2;
            }
        });

        cardsInPlayerHand.forEach(card => {
            if (card.isDragged) {
                card.x = mouseX - card.width / 2;
                card.y = mouseY - card.height / 2;
            }
        });
    }

    // Check for hover mechanics
    cardsInPlayerHand.forEach(card => {
        card.isHover = false;
    });

    // Check for hover mechanics.
    if (gameState.dragActive == false) {
        for (let i = cardsInPlayerHand.length - 1; i >= 0; i--) {
            let card = cardsInPlayerHand[i];
            if (isMouseOverCard(card)) {
                card.isHover = true;
                break;
            }
        };

        let numCardsInDiscard = cardsInPlayerDiscard.length
        if (numCardsInDiscard > 0) {
            let card = cardsInPlayerDiscard[numCardsInDiscard - 1];
            if (isMouseOverCard(card)) {
                card.isHover = true;
            }
        }
    }
    draw();
});

function cardInSnapArea(snapArea) {
    return mouseX >= snapArea.x && mouseX <= snapArea.x + snapArea.width &&
        mouseY >= snapArea.y && mouseY <= snapArea.y + snapArea.height;
}


function handleFreeCardMoved() {
    // Check to see if the card moved from the board "canvas" into hand.
    for (let i = allCards.length - 1; i >= 0; i--) {
        let card = allCards[i];
        if (card.isDragged) {
            // Snap to the target area if it's close enough
            if (cardInSnapArea(playerHand)) {
                // Move the selected card to the top of the stack (bring it to front)
                const selectedCard = allCards.splice(i, 1)[0]; // Remove card from array
                placeCardInHand(selectedCard)
            } else if (cardInSnapArea(discardPile)) {
                const selectedCard = allCards.splice(i, 1)[0];
                placeCardInDiscard(selectedCard)
            } else {
                const selectedCard = allCards.splice(i, 1)[0]; // Remove card from array
                removeCardFromHand(selectedCard);
            }
            card.isDragged = false;
            gameState.dragActive = false;
            break;
        }
    }
}

function handlePlayerCardMoved() {
    // Check to see if card moved from hand onto board.
    for (let i = cardsInPlayerHand.length - 1; i >= 0; i--) {
        let card = cardsInPlayerHand[i];
        if (card.isDragged) {
            if (cardInSnapArea(playerHand) == false) {
                const selectedCard = cardsInPlayerHand.splice(i, 1)[0];
                removeCardFromHand(selectedCard)
            } else {
                // Move the selected card to the top of the stack (bring it to front)
                const selectedCard = cardsInPlayerHand.splice(i, 1)[0];
                placeCardInHand(selectedCard)
            }
            card.isDragged = false;
            gameState.dragActive = false;
            break;
        }
    }
}

function handleDrawDeckRelease() {
    if (cardsInDrawDeck.length > 0) {
        if (isMouseOverCard(cardsInDrawDeck[0])) {
            console.log("Use clicked on draw deck")
            let randomIndex = Math.floor(Math.random() * cardsInDrawDeck.length);
            const pulledCard = cardsInDrawDeck.splice(randomIndex, 1)[0];
            placeCardInHand(pulledCard);
        }
    }
}

// Handle mouse up event to stop dragging and snap the card
canvas.addEventListener('mouseup', () => {

    // Modifying cards while looping through it?? ehh..
    handleFreeCardMoved()
    handlePlayerCardMoved()
    handleDrawDeckRelease()

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
        allCards.push(newCard);
    }
    draw();
})

// Initial draw
draw();