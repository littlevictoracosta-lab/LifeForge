class GameData {
    constructor() {
        this.events = [];
        this.careers = [];
        this.countries = [];
        this.achievements = [];
        this.familyData = {}; // Added family data container
    }

    async loadAll() {
        try {
            const [evRes, carRes, couRes, achRes, famRes] = await Promise.all([
                fetch('events.json'),
                fetch('careers.json'),
                fetch('countries.json'),
                fetch('achievements.json'),
                fetch('family.json') // Load family configuration
            ]);
            this.events = await evRes.json();
            this.careers = await carRes.json();
            this.countries = await couRes.json();
            this.achievements = await achRes.json();
            this.familyData = await famRes.json();
        } catch (err) {
            console.error("Failed loading JSON game data:", err);
        }
    }
}
