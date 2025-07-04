const CARD_SCALE = 0.9;

const CARD_WIDTH_ACTUAL = 714;
const CARD_HEIGHT_ACTUAL = 994;
const cardAspectRatio = CARD_WIDTH_ACTUAL / CARD_HEIGHT_ACTUAL;

const canvasAspectRatio = 4/3 ; // derived??

export const CARD_WIDTH = 0.08 * CARD_SCALE;
export const CARD_HEIGHT = (CARD_WIDTH / cardAspectRatio)*canvasAspectRatio;
export const CARD_PREVIEW_SCALE_FACTOR = 2.0;

export const SITE_CARD_X = 0.01;
export const SITE_CARD_Y = 0.01;

export const SITE_CARD_HEIGHT =

1.0*CARD_WIDTH*canvasAspectRatio;
export const SITE_CARD_WIDTH = 1.0*CARD_HEIGHT / canvasAspectRatio;

export const Margin = 0.005;

const BOARD_MARGIN = 0.020;
const BOTTOM_CARD_BAR = 1.0 - (CARD_HEIGHT + BOARD_MARGIN);
const OPPONENT_AREA_OFFSET = 0.05;

export const COMPANION_POSSESIONS_OFFSET = 0.0125;
export const PLAYER_HAND_OFFSET = CARD_WIDTH /2.2;
export const PLAYER_HAND_PEEK_HEIGHT = 0.1;
export const OPPONENT_HAND_OFFSET = CARD_WIDTH / 4;
export const CARD_PREVIEW_SHIFT = 0.02;
export const DRAW_DECK_SHIFT = 0.0025;

export const COMPANION_SLOT_OFFSET = (CARD_WIDTH + 1.7*COMPANION_POSSESIONS_OFFSET);
export const HEALTH_DIAMOND_SIZE = 0.005;


const PLAYER_HAND_WIDTH = CARD_WIDTH * 5.5;

export const HEALTH_DIAMOND_COLOR = 'rgb(130, 0, 0)';
export const BURDEN_DIAMOND_COLOR = 'rgb(172, 172, 172)';
export const HEALTH_DIAMOND_BORDER_COLOR = 'rgb(87, 68, 0)';

// Define the "snap area" (a target area where cards should snap when dropped)

export const supportZone = {
    x: 0.125, y: BOTTOM_CARD_BAR,
    width: 0.25 , height: CARD_HEIGHT
}

export const playerHand = {
    x: supportZone.x + supportZone.width + Margin, y: BOTTOM_CARD_BAR,
    width: PLAYER_HAND_WIDTH, height: CARD_HEIGHT
}

// Define the "snap area" (a target area where cards should snap when dropped)
export const drawDeck = {
    x: playerHand.x + playerHand.width + Margin, y: BOTTOM_CARD_BAR,
    width: CARD_WIDTH, height: CARD_HEIGHT
}

export const discardPile = {
    x: drawDeck.x + drawDeck.width + 3*Margin, y: BOTTOM_CARD_BAR,
    width: CARD_WIDTH, height: CARD_HEIGHT
}
// Note the width is not used during drawing, only during snap calculations
export const companionZone = {
    x: supportZone.x, y: supportZone.y - (CARD_HEIGHT + Margin),
    width: (COMPANION_SLOT_OFFSET)*9, height: playerHand.height
}
export const companionInfoZone = {
    x: companionZone.x, y: companionZone.y - 4*Margin,
    width: companionZone.width, height: 4*Margin
}

export const deadPile = {
    x: discardPile.x + discardPile.width + Margin, y: playerHand.y,
    width: SITE_CARD_WIDTH, height: SITE_CARD_HEIGHT
}
// Opponent card hand areas
export const opponentDeadPile = {
    x: companionZone.x, y: OPPONENT_AREA_OFFSET,
    width: deadPile.width, height:deadPile.height
}
export const opponentDiscardPile = {
    x: companionZone.x, y: OPPONENT_AREA_OFFSET,
    width: CARD_WIDTH, height: CARD_HEIGHT
}

export const opponentDeck = {
    x: opponentDiscardPile.x + opponentDiscardPile.width + Margin, y: OPPONENT_AREA_OFFSET,
    width: CARD_WIDTH, height: CARD_HEIGHT
}

export const opponentHand = {
    x: opponentDeck.x + opponentDeck.width + 3*Margin, y: OPPONENT_AREA_OFFSET,
    width: playerHand.width, height: CARD_HEIGHT,
}

export const opponentSupportZone = {
    x: opponentHand.x + opponentHand.width + Margin, y: OPPONENT_AREA_OFFSET,
    width: supportZone.width, height: CARD_HEIGHT,
}

export const opponentCompanionZone = {
    x: opponentDeadPile.x, y: opponentDiscardPile.y + (CARD_HEIGHT + Margin),
    width: companionZone.width, height: CARD_HEIGHT
}


export const siteSlots = [];
for (let i = 0; i < 9; i++) {
    siteSlots.push({
        x: SITE_CARD_X,
        y: SITE_CARD_Y + ((SITE_CARD_HEIGHT+Margin) * i),
        width: SITE_CARD_WIDTH, height: SITE_CARD_HEIGHT
    });
}

export const discardPreviewArea = {
    x: 0.10, y: 0.10, width: 0.80, height: 0.70
}

export const companionPreviewArea = {
    x: companionZone.x, y: companionZone.y - (Margin + CARD_HEIGHT),
    width: companionZone.width, height:CARD_HEIGHT + 2*Margin
}

export const twilightContainerArea = { 
    x: 0.85, y: 0.50 - 0.025, width: .05, height: .05
}

export const TOKEN_WIDTH = 0.04;
export const TOKEN_HEIGHT = 0.04;
export const buttonWidth =  CARD_WIDTH/2; //  * (3 / 2);
export const buttonHeight = buttonWidth;

export const healthBarHeight = 2*Margin;
export const healthBarWidth = CARD_WIDTH;

export const playerSkirmishArea = {
    x: 0.5, y: companionZone.y - (CARD_HEIGHT + Margin),
    width: CARD_WIDTH, height: CARD_HEIGHT,
}

export const opponentSkirmishArea = {
    x: 0.5, y: companionZone.y - (CARD_HEIGHT + Margin),
    width: CARD_WIDTH, height: CARD_HEIGHT,
}

export const siteControlArea = {
    x: SITE_CARD_X, y: SITE_CARD_Y + (SITE_CARD_HEIGHT + Margin) *9 + Margin,
    width: SITE_CARD_WIDTH, height: SITE_CARD_WIDTH * (61/133) / (3/4)
}
export const siteButtonOffset = siteControlArea.height / 2 - (buttonHeight /2);

export const burdenBidPopupArea = {
     x: 0.4, y: 0.4, width: 0.2, height: 0.2
}
export const burdenBidArea = {
    x: burdenBidPopupArea.x ,
    y: burdenBidPopupArea.y + burdenBidPopupArea.height*.4,
    width: burdenBidPopupArea.width, height: burdenBidPopupArea.width * (61/133) / (3/4)
}

export const gameStateArea = {
    x: opponentDiscardPile.x, y:0,
    width: (opponentSupportZone.x + opponentSupportZone.width) - opponentDiscardPile.x,
    height: opponentHand.y - Margin
}

export const ARROW_WIDTH = gameStateArea.height;
export const ARROW_HEIGHT = gameStateArea.height;
