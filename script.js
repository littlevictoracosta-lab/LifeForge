/**
 * LifeStream Simulator - Core Game Engine
 * Object-Oriented Architecture for handling game loop, state, UI, and event dispatching.
 */

// --- DATA MANAGERS & UTILS ---
class SVGAvatarGenerator {
    static generate(gender, seed = 0) {
        const hairColors = ['#2c1b18', '#4a3728', '#b55239', '#d69d2a', '#e6cea8'];
        const skinColors = ['#f8d5c2', '#e0ac69', '#c68642', '#8d5524', '#3a2211'];
        const hairColor = hairColors[seed % hairColors.length];
        const skinColor = skinColors[(seed * 3) % skinColors.length];

        return `
        <svg viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="${skinColor}" />
            <circle cx="35" cy="40" r="5" fill="#333" />
            <circle cx="65" cy="40" r="5" fill="#333" />
            <path d="M 35 65 Q 50 80 65 65" stroke="#333" stroke-width="3" fill="none" />
            <path d="M 20 30 Q 50 ${gender === 'Female' ? '10' : '20'} 80 30" stroke="${hairColor}" stroke-width="12" fill="none" />
        </svg>`;
    }
}

class GameData {
    constructor() {
        this.events = [];
        this.careers = [];
        this.countries = [];
        this.achievements = [];
    }

    async loadAll() {
        try {
            const [evRes, carRes, couRes, achRes] = await Promise.all([
                fetch('events.json'),
                fetch('careers.json'),
                fetch('countries.json'),
                fetch('achievements.json')
            ]);
            this.events = await evRes.json();
            this.careers = await carRes.json();
            this.countries = await couRes.json();
            this.achievements = await achRes.json();
        } catch (err) {
            console.error("Failed loading JSON game data:", err);
        }
    }
}

// --- CHARACTER MODEL ---
class Character {
    constructor(data = {}) {
        this.firstName = data.firstName || "Alex";
        this.lastName = data.lastName || "Smith";
        this.gender = data.gender || "Male";
        this.country = data.country || "USA";
        this.age = data.age || 0;
        this.money = data.money || 0;
        
        // Base Stats (0 - 100)
        this.happiness = data.happiness ?? 80;
        this.health = data.health ?? 90;
        this.intelligence = data.intelligence ?? Math.floor(Math.random() * 60 + 20);
        this.looks = data.looks ?? Math.floor(Math.random() * 60 + 20);
        this.fame = data.fame ?? 0;
        this.karma = data.karma ?? 50;
        this.stress = data.stress ?? 0;
        this.energy = data.energy ?? 100;

        // Relationships & Status
        this.relationships = data.relationships || [];
        this.job = data.job || null;
        this.education = data.education || "None";
        this.inventory = data.inventory || [];
        this.unlockedAchievements = data.unlockedAchievements || [];
        this.isAlive = data.isAlive ?? true;
        this.seed = data.seed || Math.floor(Math.random() * 1000);
    }

    clampStats() {
        const stats = ['happiness', 'health', 'intelligence', 'looks', 'fame', 'karma', 'stress', 'energy'];
        stats.forEach(s => {
            this[s] = Math.max(0, Math.min(100, this[s]));
        });
    }

    applyEffects(effects = {}) {
        for (let key in effects) {
            if (key in this) {
                this[key] += effects[key];
            }
        }
        this.clampStats();
    }
}

// --- MAIN ENGINE CLASS ---
class LifeEngine {
    constructor() {
        this.data = new GameData();
        this.character = null;
        this.difficulty = "Normal";
        this.initUI();
    }

    async init() {
        await this.data.loadAll();
        if (!this.loadGame()) {
            this.createNewLife();
        } else {
            this.updateUI();
        }
    }

    createNewLife() {
        const randomCountry = this.data.countries[Math.floor(Math.random() * this.data.countries.length)] || { name: "USA", maleNames: ["John"], femaleNames: ["Jane"], lastNames: ["Doe"] };
        const gender = Math.random() > 0.5 ? "Male" : "Female";
        const firstList = gender === "Male" ? randomCountry.maleNames : randomCountry.femaleNames;
        const firstName = firstList[Math.floor(Math.random() * firstList.length)];
        const lastName = randomCountry.lastNames[Math.floor(Math.random() * randomCountry.lastNames.length)];

        this.character = new Character({
            firstName,
            lastName,
            gender,
            country: randomCountry.name
        });

        // Add initial parents
        this.character.relationships.push({
            name: `Mother (${lastName})`,
            type: "Parent",
            relationship: 80
        });
        this.character.relationships.push({
            name: `Father (${lastName})`,
            type: "Parent",
            relationship: 75
        });

        const feed = document.getElementById("eventFeed");
        feed.innerHTML = "";
        this.logEvent(`You were born in ${randomCountry.name} as ${firstName} ${lastName}.`);
        this.saveGame();
        this.updateUI();
    }

    ageUp() {
        if (!this.character || !this.character.isAlive) return;

        this.character.age++;
        
        // Primary Life Progression Events
        if (this.character.age === 5) this.character.education = "Elementary School";
        if (this.character.age === 11) this.character.education = "Middle School";
        if (this.character.age === 14) this.character.education = "High School";
        if (this.character.age === 18) this.character.education = "High School Graduate";

        // Natural Stat Shifts
        this.character.health -= Math.floor(Math.random() * (this.character.age > 60 ? 4 : 2));
        this.character.energy = 100;
        this.character.clampStats();

        this.logEvent(`You turned ${this.character.age} years old.`);

        // Death Check
        if (this.character.health <= 0 || (this.character.age > 75 && Math.random() < (this.character.age - 70) * 0.03)) {
            this.handleDeath();
            return;
        }

        // Trigger Random Event
        this.triggerRandomEvent();
        this.checkAchievements();
        this.saveGame();
        this.updateUI();
    }

    triggerRandomEvent() {
        const eligibleEvents = this.data.events.filter(e => (!e.minAge || this.character.age >= e.minAge) && (!e.maxAge || this.character.age <= e.maxAge));
        if (eligibleEvents.length === 0) return;

        const event = eligibleEvents[Math.floor(Math.random() * eligibleEvents.length)];
        this.showInteraction(event);
    }

    showInteraction(eventData) {
        const overlay = document.getElementById("interactionOverlay");
        const title = document.getElementById("eventTitle");
        const desc = document.getElementById("eventDescription");
        const choicesContainer = document.getElementById("eventChoices");

        title.textContent = eventData.title;
        desc.textContent = eventData.description;
        choicesContainer.innerHTML = "";

        eventData.choices.forEach(choice => {
            const btn = document.createElement("button");
            btn.className = "btn btn-primary";
            btn.textContent = choice.text;
            btn.onclick = () => {
                if (choice.effects) {
                    this.character.applyEffects(choice.effects);
                }
                this.logEvent(`[Decision] ${choice.text}`);
                overlay.classList.add("hidden");
                this.saveGame();
                this.updateUI();
            };
            choicesContainer.appendChild(btn);
        });

        overlay.classList.remove("hidden");
    }

    handleDeath() {
        this.character.isAlive = false;
        this.logEvent(`☠️ You died peacefully at age ${this.character.age}.`);
        alert(`Life Over! You lived for ${this.character.age} years.`);
        this.saveGame();
        this.updateUI();
    }

    logEvent(text) {
        const feed = document.getElementById("eventFeed");
        const item = document.createElement("div");
        item.className = "feed-item";
        item.innerHTML = `<span class="age-badge">Age ${this.character.age}:</span> ${text}`;
        feed.prepend(item);
    }

    checkAchievements() {
        this.data.achievements.forEach(ach => {
            if (!this.character.unlockedAchievements.includes(ach.id)) {
                let unlocked = false;
                if (ach.condition === "age" && this.character.age >= ach.value) unlocked = true;
                if (ach.condition === "money" && this.character.money >= ach.value) unlocked = true;

                if (unlocked) {
                    this.character.unlockedAchievements.push(ach.id);
                    this.logEvent(`🏆 Achievement Unlocked: ${ach.title}`);
                    if (typeof confetti === 'function') confetti();
                }
            }
        });
    }

    saveGame() {
        localStorage.setItem("lifestream_save", JSON.stringify(this.character));
    }

    loadGame() {
        const saved = localStorage.getItem("lifestream_save");
        if (saved) {
            this.character = new Character(JSON.parse(saved));
            return true;
        }
        return false;
    }

    initUI() {
        document.getElementById("btnAgeUp").addEventListener("click", () => this.ageUp());
        document.getElementById("btnNewLife").addEventListener("click", () => {
            if (confirm("Are you sure you want to start a new life? Current progress will be lost.")) {
                this.createNewLife();
            }
        });
        document.getElementById("modalClose").addEventListener("click", () => {
            document.getElementById("modal").classList.add("hidden");
        });
        document.getElementById("btnCareers").addEventListener("click", () => this.openCareersModal());
        document.getElementById("btnActivities").addEventListener("click", () => this.openActivitiesModal());
    }

    updateUI() {
        if (!this.character) return;
        const c = this.character;

        // Info
        document.getElementById("charName").textContent = `${c.firstName} ${c.lastName}`;
        document.getElementById("charTitle").textContent = c.job ? c.job.title : c.education;
        document.getElementById("charDetails").textContent = `${c.age} yrs old • ${c.country}`;
        document.getElementById("avatarContainer").innerHTML = SVGAvatarGenerator.generate(c.gender, c.seed);

        // Stats
        const stats = ['Happiness', 'Health', 'Intelligence', 'Looks', 'Fame', 'Karma', 'Stress', 'Energy'];
        stats.forEach(s => {
            const key = s.toLowerCase();
            const val = c[key];
            document.getElementById(`val${s}`).textContent = `${val}%`;
            document.getElementById(`bar${s}`).style.width = `${val}%`;
        });

        // Summary
        document.getElementById("valMoney").textContent = `$${c.money.toLocaleString()}`;
        document.getElementById("valJob").textContent = c.job ? c.job.title : "Unemployed";
        document.getElementById("valEducation").textContent = c.education;

        // Relationships
        const relContainer = document.getElementById("relationshipList");
        relContainer.innerHTML = "";
        c.relationships.forEach(r => {
            const div = document.createElement("div");
            div.className = "list-item";
            div.innerHTML = `<span>${r.name} (${r.type})</span><span>${r.relationship}%</span>`;
            relContainer.appendChild(div);
        });

        // Achievements Preview
        const achContainer = document.getElementById("achieveList");
        achContainer.innerHTML = "";
        document.getElementById("achieveCount").textContent = c.unlockedAchievements.length;
        c.unlockedAchievements.forEach(achId => {
            const ach = this.data.achievements.find(a => a.id === achId);
            if (ach) {
                const div = document.createElement("div");
                div.className = "list-item";
                div.textContent = `🏆 ${ach.title}`;
                achContainer.appendChild(div);
            }
        });

        // Age Up Button state
        document.getElementById("btnAgeUp").disabled = !c.isAlive;
    }

    openCareersModal() {
        const modal = document.getElementById("modal");
        const title = document.getElementById("modalTitle");
        const body = document.getElementById("modalBody");
        title.textContent = "Job Market";
        body.innerHTML = "";

        this.data.careers.forEach(job => {
            const div = document.createElement("div");
            div.className = "list-item";
            div.style.marginBottom = "8px";
            div.innerHTML = `
                <div>
                    <strong>${job.title}</strong> - $${job.salary}/yr
                    <br><small>Req: Intel ${job.reqIntel}%</small>
                </div>
            `;
            const applyBtn = document.createElement("button");
            applyBtn.className = "btn btn-primary";
            applyBtn.textContent = "Apply";
            applyBtn.onclick = () => {
                if (this.character.intelligence >= job.reqIntel) {
                    this.character.job = job;
                    this.logEvent(`You were hired as a ${job.title}!`);
                    modal.classList.add("hidden");
                    this.updateUI();
                } else {
                    alert("You were rejected due to qualifications.");
                }
            };
            div.appendChild(applyBtn);
            body.appendChild(div);
        });

        modal.classList.remove("hidden");
    }

    openActivitiesModal() {
        const modal = document.getElementById("modal");
        const title = document.getElementById("modalTitle");
        const body = document.getElementById("modalBody");
        title.textContent = "Lifestyle & Activities";
        body.innerHTML = `
            <div class="menu-grid">
                <button id="actGym" class="btn btn-menu">🏋️ Go to Gym (+Health)</button>
                <button id="actRead" class="btn btn-menu">📚 Read Book (+Intel)</button>
                <button id="actMeditate" class="btn btn-menu">🧘 Meditate (+Happiness)</button>
            </div>
        `;

        modal.classList.remove("hidden");

        document.getElementById("actGym").onclick = () => {
            this.character.applyEffects({ health: 5, happiness: 2, energy: -10 });
            this.logEvent("You worked out at the gym.");
            modal.classList.add("hidden");
            this.updateUI();
        };
        document.getElementById("actRead").onclick = () => {
            this.character.applyEffects({ intelligence: 5, stress: -2 });
            this.logEvent("You read an informative book.");
            modal.classList.add("hidden");
            this.updateUI();
        };
        document.getElementById("actMeditate").onclick = () => {
            this.character.applyEffects({ happiness: 5, stress: -10 });
            this.logEvent("You meditated peacefully.");
            modal.classList.add("hidden");
            this.updateUI();
        };
    }
}

// Global Initialization
window.addEventListener("DOMContentLoaded", () => {
    window.game = new LifeEngine();
    window.game.init();
});










// --- PARENT MODEL CLASS ---
class Parent {
    constructor(data = {}) {
        this.firstName = data.firstName || "Jane";
        this.lastName = data.lastName || "Doe";
        this.gender = data.gender || "Female";
        this.age = data.age || 30;
        this.occupation = data.occupation || "Unemployed";
        this.salary = data.salary || 0;
        this.education = data.education || "High School";
        this.happiness = data.happiness ?? 75;
        this.health = data.health ?? 85;
        this.intelligence = data.intelligence ?? 50;
        this.relationship = data.relationship ?? 80;
        this.isAlive = data.isAlive ?? true;
        this.jobData = data.jobData || null; // Stores promotion track info
    }

    // Clamp stats between 0 and 100
    clampStats() {
        this.happiness = Math.max(0, Math.min(100, this.happiness));
        this.health = Math.max(0, Math.min(100, this.health));
        this.intelligence = Math.max(0, Math.min(100, this.intelligence));
        this.relationship = Math.max(0, Math.min(100, this.relationship));
    }
}

// --- FAMILY SYSTEM CONTROLLER ---
class FamilySystem {
    constructor(gameData) {
        this.gameData = gameData;
        this.mother = null;
        this.father = null;
    }

    // Generate random realistic parents on new life
    generateParents(lastName, countryData) {
        const educations = ["None", "High School", "Trade School", "College", "University"];
        
        // Helper to select random job matching education tier
        const getRandomJob = (edu) => {
            const jobs = this.gameData.familyData.parentJobs;
            let available = jobs.filter(j => j.reqEducation === edu);
            if (available.length === 0) available = jobs;
            return available[Math.floor(Math.random() * available.length)];
        };

        // Generate Mother
        const momEdu = educations[Math.floor(Math.random() * educations.length)];
        const momJob = getRandomJob(momEdu);
        this.mother = new Parent({
            firstName: countryData.femaleNames[Math.floor(Math.random() * countryData.femaleNames.length)],
            lastName: lastName,
            gender: "Female",
            age: Math.floor(Math.random() * 15) + 22, // 22 - 36 years old
            occupation: momJob.title,
            salary: momJob.salary,
            education: momEdu,
            jobData: momJob
        });

        // Generate Father
        const dadEdu = educations[Math.floor(Math.random() * educations.length)];
        const dadJob = getRandomJob(dadEdu);
        this.father = new Parent({
            firstName: countryData.maleNames[Math.floor(Math.random() * countryData.maleNames.length)],
            lastName: lastName,
            gender: "Male",
            age: Math.floor(Math.random() * 15) + 24, // 24 - 38 years old
            occupation: dadJob.title,
            salary: dadJob.salary,
            education: dadEdu,
            jobData: dadJob
        });
    }

    // Calculate household bracket
    getFamilyIncomeTier() {
        const totalIncome = (this.mother.isAlive ? this.mother.salary : 0) + 
                           (this.father.isAlive ? this.father.salary : 0);
        
        const tiers = this.gameData.familyData.socioeconomicTiers;
        for (let t of tiers) {
            if (totalIncome >= t.minIncome && totalIncome <= t.maxIncome) {
                return { tier: t.tier, totalIncome };
            }
        }
        return { tier: "Millionaire", totalIncome };
    }

    // Dynamic annual simulation tick for parents
    ageUpParents(logCallback) {
        [this.mother, this.father].forEach(parent => {
            if (!parent || !parent.isAlive) return;

            parent.age++;
            
            // Age health drop
            if (parent.age > 50) {
                parent.health -= Math.floor(Math.random() * 3) + 1;
            }

            // Check parent death
            if (parent.health <= 0 || (parent.age > 75 && Math.random() < (parent.age - 70) * 0.04)) {
                parent.isAlive = false;
                parent.occupation = "Deceased";
                parent.salary = 0;
                logCallback(`💔 Your ${parent.gender === "Female" ? "mother" : "father"}, ${parent.firstName}, has passed away at age ${parent.age}.`);
                return;
            }

            // Retirement Check
            if (parent.age >= 65 && parent.occupation !== "Retired") {
                parent.occupation = "Retired";
                parent.salary = Math.floor(parent.salary * 0.6); // Pension
                logCallback(`👴 Your ${parent.gender === "Female" ? "mother" : "father"} retired at age ${parent.age}.`);
                return;
            }

            // Skip event rolls if retired
            if (parent.occupation === "Retired") return;

            // Random Life Event Roll (25% chance per parent per year)
            const eventRoll = Math.random();

            if (eventRoll < 0.05) { // Promotion
                if (parent.jobData && parent.jobData.promotions && parent.jobData.promotions.length > 0) {
                    const nextJob = parent.jobData.promotions.shift();
                    parent.occupation = nextJob;
                    parent.salary = Math.floor(parent.salary * 1.25);
                    logCallback(`📈 Your ${parent.gender === "Female" ? "mother" : "father"} got promoted to ${nextJob}!`);
                }
            } else if (eventRoll < 0.08) { // Pay Raise
                const raise = Math.floor(parent.salary * 0.08);
                parent.salary += raise;
                logCallback(`💵 Your ${parent.gender === "Female" ? "mother" : "father"} got a salary raise!`);
            } else if (eventRoll < 0.11) { // Job Loss
                parent.occupation = "Unemployed";
                parent.salary = 0;
                logCallback(`⚠️ Your ${parent.gender === "Female" ? "mother" : "father"} lost their job.`);
            } else if (eventRoll < 0.14) { // Found New Job
                if (parent.occupation === "Unemployed") {
                    const jobs = this.gameData.familyData.parentJobs;
                    const newJob = jobs[Math.floor(Math.random() * jobs.length)];
                    parent.occupation = newJob.title;
                    parent.salary = newJob.salary;
                    parent.jobData = newJob;
                    logCallback(`💼 Your ${parent.gender === "Female" ? "mother" : "father"} started working as a ${newJob.title}.`);
                }
            } else if (eventRoll < 0.16) { // Illness
                parent.health -= 20;
                logCallback(`🤒 Your ${parent.gender === "Female" ? "mother" : "father"} fell ill.`);
            } else if (eventRoll < 0.17) { // Lottery Win
                parent.salary += 50000;
                logCallback(`🎉 Your parents won a small lottery prize!`);
            }
            
            parent.clampStats();
        });

        // House upgrade event (2% chance if middle class or above)
        const incomeInfo = this.getFamilyIncomeTier();
        if (incomeInfo.totalIncome > 60000 && Math.random() < 0.02) {
            logCallback(`🏡 Your parents bought a new house!`);
        }
    }
}
