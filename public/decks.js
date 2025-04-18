// The lotr index and images are pulled from wiki.lotrcgps.net.

function deckName2Csv(deckName) {
    switch (deckName) {
        case "Aragorn":
            return "Fellowship_Aragorn_Starter.csv"
        case "Gandalf":
            return "Fellowship_Gandalf_Starter.csv"
        default:
            console.error("Deck does not exist");
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
