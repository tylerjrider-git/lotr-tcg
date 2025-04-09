const CARD_SCALE = 0.8;
const CARD_WIDTH = 0.085 * CARD_SCALE;
const CARD_HEIGHT = 0.20 * CARD_SCALE;

const SITE_CARD_X = 0.030;
const SITE_CARD_Y = 0.030;

const SITE_CARD_WIDTH = .1;
const SITE_CARD_HEIGHT = .105;

const GAP = 0.005;

const BOARD_MARGIN = 0.020;
const BOTTOM_CARD_BAR = 1.0 - (CARD_HEIGHT + BOARD_MARGIN);
const OPPONENT_HAND_OFFSET = SITE_CARD_Y;

const PLAYER_HAND_WIDTH = CARD_WIDTH * 3.4;
// Define the "snap area" (a target area where cards should snap when dropped)

export const supportZone = {
    x: 0.15, y: BOTTOM_CARD_BAR,
    width: PLAYER_HAND_WIDTH /2 , height: CARD_HEIGHT
}

export const playerHand = {
    x: supportZone.x + supportZone.width + GAP, y: BOTTOM_CARD_BAR,
    width: PLAYER_HAND_WIDTH, height: CARD_HEIGHT
}

// Define the "snap area" (a target area where cards should snap when dropped)
export const drawDeck = {
    x: playerHand.x + playerHand.width + 2*GAP, y: playerHand.y,
    width: CARD_WIDTH, height: CARD_HEIGHT
}

export const discardPile = {
    x: drawDeck.x + drawDeck.width + 2*GAP, y: playerHand.y,
    width: CARD_WIDTH, height: CARD_HEIGHT
}
export const companionZone = {
    x: supportZone.x, y: playerHand.y - (CARD_HEIGHT + GAP),
    width: CARD_WIDTH*9, height: playerHand.height
}

export const deadPile = {
    x: discardPile.x + discardPile.width + GAP, y: playerHand.y,
    width: SITE_CARD_WIDTH, height: SITE_CARD_HEIGHT
}
// Opponent card hand areas
export const opponentDeadPile = {
    x: companionZone.x, y: OPPONENT_HAND_OFFSET,
    width: deadPile.width, height:deadPile.height
}
export const opponentDiscardPile = {
    x: opponentDeadPile.x + opponentDeadPile.width + GAP, y: OPPONENT_HAND_OFFSET,
    width: CARD_WIDTH, height: CARD_HEIGHT
}

export const opponentDeck = {
    x: opponentDiscardPile.x + opponentDiscardPile.width + GAP, y: OPPONENT_HAND_OFFSET,
    width: CARD_WIDTH, height: CARD_HEIGHT
}

export const opponentHand = {
    x: opponentDeck.x + opponentDeck.width + 2*GAP, y: OPPONENT_HAND_OFFSET,
    width: playerHand.width, height: CARD_HEIGHT,
}

export const opponentSupportZone = {
    x: opponentHand.x + opponentHand.width + GAP, y: OPPONENT_HAND_OFFSET,
    width: supportZone.width, height: CARD_HEIGHT,
}

export const opponentCompanionZone = {
    x: opponentDeadPile.x, y: opponentDiscardPile.y + (CARD_HEIGHT + GAP),
    width: companionZone.width, height: CARD_HEIGHT
}


export const siteSlots = [];
for (let i = 0; i < 9; i++) {
    siteSlots.push({
        x: SITE_CARD_X,
        y: SITE_CARD_Y + ((SITE_CARD_HEIGHT) * i),
        width: SITE_CARD_WIDTH, height: SITE_CARD_HEIGHT
    });
}