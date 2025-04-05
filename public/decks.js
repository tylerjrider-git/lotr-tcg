// The lotr index and images are pulled from wiki.lotrcgps.net.

export const LOTR_STARTER_DECK_ARAGORN = [
    "LOTR-EN01290",
    "LOTR-EN01002",
    // Sites
    "LOTR-EN01326",
    "LOTR-EN01337",
    "LOTR-EN01345",
    "LOTR-EN01349",
    "LOTR-EN01350",
    "LOTR-EN01353",
    "LOTR-EN01359",
    "LOTR-EN01360",
    // Free peoples
    "LOTR-EN01364", "LOTR-EN01364",
    "LOTR-EN01097",
    "LOTR-EN01012", "LOTR-EN01012",
    "LOTR-EN01051", "LOTR-EN01051",
    "LOTR-EN01079",
    "LOTR-EN01286", "LOTR-EN01286", "LOTR-EN01286",
    "LOTR-EN01299",
    "LOTR-EN01037", "LOTR-EN01037",
    "LOTR-EN01076", "LOTR-EN01076", "LOTR-EN01076",
    "LOTR-EN01078", "LOTR-EN01078", "LOTR-EN01078",
    "LOTR-EN01304",
    "LOTR-EN01026", "LOTR-EN01026", "LOTR-EN01026",
    "LOTR-EN01086",
    // Shadow cards.
    "LOTR-EN01176", "LOTR-EN01176", "LOTR-EN01176",
    "LOTR-EN01178", "LOTR-EN01178", "LOTR-EN01178",
    "LOTR-EN01179", "LOTR-EN01179", "LOTR-EN01179",
    "LOTR-EN01181", "LOTR-EN01181", "LOTR-EN01181",
    "LOTR-EN01191", "LOTR-EN01191", "LOTR-EN01191",
    "LOTR-EN01180", "LOTR-EN01180", "LOTR-EN01180",
    "LOTR-EN01168", "LOTR-EN01168", "LOTR-EN01168",
    "LOTR-EN01187", "LOTR-EN01187", "LOTR-EN01187",
    "LOTR-EN01106", "LOTR-EN01196",
]

function deckName2Csv(deckName) {
    switch (deckName) {
        case "Aragorn":
            return "Fellowship_Aragorn_Starter.csv"
        case "Gandalf":
            return "Fellowship_Gandalf_Starter.csv"
        default:
            console.error("Deck does not exist")
            break;
    }
}



async function initializePlayerDeck(deckName) {
    let deckCsv = deckName2Csv(deckName);
    try {
        const response = await fetch(deckCsv);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        const lines = text.trim().split('\n');
        const headers = lines[0].split(',');

        const objects = lines.slice(1).map(line => {
            const values = line.split(',');
            return {
                "cardNumber": values[0],
                "cardName": values[1].replace('|', ','),
                "cardId": values[2],
                "cardSide": values[3],
                "cardType": values[4],
                "cardSiteNum": values[5].trim()
            }
        });
        return objects;
    } catch(err) {
        alert("Error reading in CSV:", err);
    }
    return null;
}

export { initializePlayerDeck }
