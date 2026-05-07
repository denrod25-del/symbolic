// Text Adventure Game — demonstrates core C++ OOP concepts:
//   Encapsulation, Inheritance, Polymorphism, Abstract Classes, Composition, RAII

#include <algorithm>
#include <cstdlib>
#include <ctime>
#include <iostream>
#include <limits>
#include <map>
#include <sstream>
#include <string>
#include <vector>

// Forward declarations needed because Room references Enemy/Item before they are defined
class Item;
class Enemy;
class Room;

// ─────────────────────────────────────────────────────────────────────────────
// ENTITY — Abstract base class (Encapsulation + Polymorphism)
// Encapsulation: name and description are protected; external code uses getters.
// Polymorphism:  display() is pure virtual — resolved at runtime via vtable.
// ─────────────────────────────────────────────────────────────────────────────
class Entity {
protected:
    std::string name;
    std::string description;

public:
    Entity(const std::string& n, const std::string& d) : name(n), description(d) {}
    virtual ~Entity() = default;

    const std::string& getName()        const { return name; }
    const std::string& getDescription() const { return description; }

    // Pure virtual: every concrete subclass must override this (Abstract class)
    virtual void display() const = 0;
};

// ─────────────────────────────────────────────────────────────────────────────
// ITEM — Inherits Entity (Inheritance)
// Represents objects the player can pick up, use, or equip.
// ─────────────────────────────────────────────────────────────────────────────
class Item : public Entity {
private:
    int  healAmount;   // HP restored when used (0 = not a healing item)
    int  attackBonus;  // Extra attack added when equipped as weapon (0 = not a weapon)
    bool consumable;   // Removed from inventory after use if true
    bool equipped;     // Whether this item is the player's active weapon

public:
    Item(const std::string& n, const std::string& d,
         int heal, int atk, bool cons)
        : Entity(n, d), healAmount(heal), attackBonus(atk),
          consumable(cons), equipped(false) {}

    int  getHealAmount()  const { return healAmount; }
    int  getAttackBonus() const { return attackBonus; }
    bool isConsumable()   const { return consumable; }
    bool isEquipped()     const { return equipped; }
    void setEquipped(bool state) { equipped = state; }

    // Polymorphism: overrides Entity::display() — called via Entity* at runtime
    void display() const override {
        std::cout << "  [" << name << "] " << description;
        if (equipped)      std::cout << " (equipped)";
        if (attackBonus > 0) std::cout << " [+" << attackBonus << " ATK]";
        if (healAmount > 0)  std::cout << " [heals " << healAmount << " HP]";
        std::cout << "\n";
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// COMBATANT — Abstract base for anything that fights (Inheritance + Abstract)
// Inherits Entity. Adds HP, attack, and defense.
// attack() is pure virtual: subclasses decide how damage is calculated.
// ─────────────────────────────────────────────────────────────────────────────
class Combatant : public Entity {
protected:
    int hp;
    int maxHp;
    int baseAttack;
    int defense;

public:
    Combatant(const std::string& n, const std::string& d,
              int hp_, int atk, int def)
        : Entity(n, d), hp(hp_), maxHp(hp_), baseAttack(atk), defense(def) {}

    int  getHp()         const { return hp; }
    int  getMaxHp()      const { return maxHp; }
    int  getBaseAttack() const { return baseAttack; }
    int  getDefense()    const { return defense; }
    bool isAlive()       const { return hp > 0; }

    void takeDamage(int amount) {
        hp = std::max(0, hp - amount);
    }

    void heal(int amount) {
        hp = std::min(maxHp, hp + amount);
    }

    // Pure virtual: forces subclasses to define their own attack logic
    virtual int  attack()      = 0;
    virtual void display() const override = 0;
};

// ─────────────────────────────────────────────────────────────────────────────
// ENEMY — Inherits Combatant (Inheritance + Polymorphism)
// ─────────────────────────────────────────────────────────────────────────────
class Enemy : public Combatant {
private:
    int         xpReward;
    std::string attackMessage;

public:
    Enemy(const std::string& n, const std::string& d,
          int hp_, int atk, int def, int xp, const std::string& msg)
        : Combatant(n, d, hp_, atk, def), xpReward(xp), attackMessage(msg) {}

    int               getXpReward()     const { return xpReward; }
    const std::string& getAttackMessage() const { return attackMessage; }

    // Polymorphism: override of pure virtual Combatant::attack()
    int attack() override {
        return baseAttack + (std::rand() % 3);
    }

    void display() const override {
        std::cout << "  * " << name << " (HP: " << hp << "/" << maxHp << ")\n";
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// PLAYER — Inherits Combatant (Inheritance + Composition)
// Composition: Player *has* a vector of Item pointers (inventory).
// The vector belongs to Player; the Items themselves are owned by Game.
// ─────────────────────────────────────────────────────────────────────────────
class Player : public Combatant {
private:
    std::vector<Item*> inventory;   // Inventory system — backed by std::vector
    Item* equippedWeapon;           // nullptr when unarmed
    int   xp;

public:
    explicit Player(const std::string& n)
        : Combatant(n, "You, the adventurer.", 50, 5, 2),
          equippedWeapon(nullptr), xp(0) {}

    // ── Inventory ────────────────────────────────────────────────────────────
    void addItem(Item* item) {
        inventory.push_back(item);
    }

    // Erase-remove idiom: find by name, erase the single matching pointer
    bool removeItem(const std::string& itemName) {
        auto it = std::find_if(inventory.begin(), inventory.end(),
            [&](Item* i){ return i->getName() == itemName; });
        if (it == inventory.end()) return false;
        inventory.erase(it);
        return true;
    }

    Item* findItem(const std::string& itemName) const {
        auto it = std::find_if(inventory.begin(), inventory.end(),
            [&](Item* i){ return i->getName() == itemName; });
        return (it != inventory.end()) ? *it : nullptr;
    }

    bool hasItem(const std::string& itemName) const {
        return findItem(itemName) != nullptr;
    }

    const std::vector<Item*>& getInventory() const { return inventory; }

    // ── Equipment ────────────────────────────────────────────────────────────
    bool equipWeapon(Item* item) {
        if (item->getAttackBonus() == 0) return false;   // not a weapon
        if (equippedWeapon) equippedWeapon->setEquipped(false);
        equippedWeapon = item;
        item->setEquipped(true);
        return true;
    }

    void unequipWeapon() {
        if (equippedWeapon) {
            equippedWeapon->setEquipped(false);
            equippedWeapon = nullptr;
        }
    }

    Item* getEquippedWeapon() const { return equippedWeapon; }

    // ── XP ───────────────────────────────────────────────────────────────────
    void gainXp(int amount) { xp += amount; }
    int  getXp()      const { return xp; }

    // Polymorphism: attack() overrides Combatant's pure virtual.
    // Adds equipped weapon's bonus on top of base attack.
    int attack() override {
        int bonus = equippedWeapon ? equippedWeapon->getAttackBonus() : 0;
        return baseAttack + bonus + (std::rand() % 4);
    }

    void display() const override {
        std::cout << name
                  << " | HP: " << hp << "/" << maxHp
                  << " | ATK: " << baseAttack
                  << (equippedWeapon ? "+" + std::to_string(equippedWeapon->getAttackBonus()) : "")
                  << " | DEF: " << defense
                  << " | XP: " << xp << "\n";
    }

    void showInventory() const {
        if (inventory.empty()) {
            std::cout << "Your pack is empty.\n";
            return;
        }
        std::cout << "Inventory:\n";
        for (Item* item : inventory) item->display();
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// ROOM — Inherits Entity (Inheritance + Composition)
// Composition: Room owns lists of items and enemies inside it,
// and a map of exits connecting it to neighbouring rooms.
// ─────────────────────────────────────────────────────────────────────────────
class Room : public Entity {
private:
    std::map<std::string, Room*> exits;   // direction name → adjacent Room
    std::vector<Item*>           items;   // items currently on the floor
    std::vector<Enemy*>          enemies; // enemies present in this room
    bool        locked;
    std::string requiredKey;              // item name needed to unlock

public:
    Room(const std::string& n, const std::string& d,
         bool lk = false, const std::string& key = "")
        : Entity(n, d), locked(lk), requiredKey(key) {}

    // ── Exits ─────────────────────────────────────────────────────────────────
    void  addExit(const std::string& dir, Room* room) { exits[dir] = room; }
    Room* getExit(const std::string& dir) const {
        auto it = exits.find(dir);
        return (it != exits.end()) ? it->second : nullptr;
    }
    const std::map<std::string, Room*>& getExits() const { return exits; }

    // ── Items ─────────────────────────────────────────────────────────────────
    void addItem(Item* item) { items.push_back(item); }

    Item* findItem(const std::string& itemName) const {
        auto it = std::find_if(items.begin(), items.end(),
            [&](Item* i){ return i->getName() == itemName; });
        return (it != items.end()) ? *it : nullptr;
    }

    // Removes the item from the room and returns it; caller takes ownership
    Item* takeItem(const std::string& itemName) {
        auto it = std::find_if(items.begin(), items.end(),
            [&](Item* i){ return i->getName() == itemName; });
        if (it == items.end()) return nullptr;
        Item* item = *it;
        items.erase(it);
        return item;
    }

    const std::vector<Item*>& getItems() const { return items; }

    // ── Enemies ───────────────────────────────────────────────────────────────
    void addEnemy(Enemy* e) { enemies.push_back(e); }

    void removeDeadEnemies() {
        // Erase-remove: removes pointers to dead enemies (does NOT delete — Game owns them)
        enemies.erase(
            std::remove_if(enemies.begin(), enemies.end(),
                [](Enemy* e){ return !e->isAlive(); }),
            enemies.end());
    }

    bool hasLivingEnemies() const {
        return std::any_of(enemies.begin(), enemies.end(),
            [](Enemy* e){ return e->isAlive(); });
    }

    Enemy* firstLivingEnemy() const {
        auto it = std::find_if(enemies.begin(), enemies.end(),
            [](Enemy* e){ return e->isAlive(); });
        return (it != enemies.end()) ? *it : nullptr;
    }

    const std::vector<Enemy*>& getEnemies() const { return enemies; }

    // ── Lock ──────────────────────────────────────────────────────────────────
    bool isLocked() const { return locked; }
    const std::string& getRequiredKey() const { return requiredKey; }

    bool tryUnlock(const Player& player) {
        if (!locked) return true;
        if (player.hasItem(requiredKey)) {
            locked = false;
            return true;
        }
        return false;
    }

    // Polymorphism: overrides Entity::display()
    void display() const override {
        std::cout << "\n=== " << name << " ===\n" << description << "\n";

        if (!items.empty()) {
            std::cout << "\nYou see:\n";
            // Calling display() on Item* — runtime polymorphism in action
            for (Item* item : items) item->display();
        }

        if (hasLivingEnemies()) {
            std::cout << "\nEnemies:\n";
            for (Enemy* e : enemies) {
                if (e->isAlive()) e->display();
            }
        }

        std::cout << "\nExits:";
        for (const auto& [dir, _] : exits) std::cout << " [" << dir << "]";
        std::cout << "\n";
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// GAME — Owns all heap objects and runs the game loop (RAII + Composition)
// RAII: Game's destructor releases every heap-allocated object.
// Composition: Game is assembled from Player, Rooms, Items, and Enemies.
// ─────────────────────────────────────────────────────────────────────────────
class Game {
private:
    Player*             player;
    Room*               currentRoom;
    std::vector<Room*>  allRooms;
    std::vector<Item*>  allItems;
    std::vector<Enemy*> allEnemies;
    bool running;
    bool won;

    // ── World setup ───────────────────────────────────────────────────────────
    void setupWorld() {
        // --- Items ---
        auto* healthPotion    = new Item("health potion",
            "A small glass vial of glowing red liquid.", 30, 0, true);
        auto* rustyKey        = new Item("rusty key",
            "An old iron key, flecked with orange rust.", 0, 0, false);
        auto* ironSword       = new Item("iron sword",
            "A serviceable blade, still sharp enough to bite.", 0, 8, false);
        auto* goldenTreasure  = new Item("golden treasure",
            "A gleaming chest overflowing with ancient gold coins.", 0, 0, false);

        allItems = { healthPotion, rustyKey, ironSword, goldenTreasure };

        // --- Enemies ---
        auto* guard = new Enemy("Guard",
            "A bored soldier in dented armour.",
            25, 5, 1, 15,
            "The Guard swings a rusty blade at you!");

        auto* skeletonLord = new Enemy("Skeleton Lord",
            "A towering undead warrior with glowing eye sockets.",
            50, 9, 3, 50,
            "The Skeleton Lord's bony fist crashes into you!");

        allEnemies = { guard, skeletonLord };

        // --- Rooms ---
        auto* entranceHall = new Room("Entrance Hall",
            "A cold stone hall. Torchlight flickers on moss-covered walls.\n"
            "A faint smell of rust drifts from the east. Something ominous\n"
            "looms to the north — a heavy door, sealed with iron.");

        auto* armory = new Room("Armory",
            "Weapon racks line the walls, most of them bare and cobwebbed.\n"
            "A lone guard stands watch — or did, until he heard you come in.");

        auto* dungeon = new Room("Dungeon",
            "The air is thick and cold. Ancient bones litter the floor.\n"
            "At the far end, something golden glimmers in the darkness.",
            true, "rusty key");  // locked; requires "rusty key"

        allRooms = { entranceHall, armory, dungeon };

        // --- Place items ---
        entranceHall->addItem(healthPotion);
        armory->addItem(rustyKey);
        armory->addItem(ironSword);
        dungeon->addItem(goldenTreasure);

        // --- Place enemies ---
        armory->addEnemy(guard);
        dungeon->addEnemy(skeletonLord);

        // --- Wire exits ---
        entranceHall->addExit("east",  armory);
        entranceHall->addExit("north", dungeon);
        armory->addExit("west", entranceHall);
        dungeon->addExit("south", entranceHall);

        // --- Create player ---
        player      = new Player("Hero");
        currentRoom = entranceHall;
    }

    // ── Input parsing ─────────────────────────────────────────────────────────

    static std::string toLower(std::string s) {
        std::transform(s.begin(), s.end(), s.begin(), ::tolower);
        return s;
    }

    static std::string trim(const std::string& s) {
        const std::string ws = " \t\r\n";
        auto start = s.find_first_not_of(ws);
        if (start == std::string::npos) return "";
        auto end = s.find_last_not_of(ws);
        return s.substr(start, end - start + 1);
    }

    // Returns {verb, rest} — both lowercased and trimmed
    static std::pair<std::string, std::string> parseCommand(const std::string& input) {
        std::string low = toLower(trim(input));
        auto spacePos = low.find(' ');
        if (spacePos == std::string::npos) return { low, "" };
        return { low.substr(0, spacePos), trim(low.substr(spacePos + 1)) };
    }

    static std::string expandDirection(const std::string& dir) {
        if (dir == "n") return "north";
        if (dir == "s") return "south";
        if (dir == "e") return "east";
        if (dir == "w") return "west";
        return dir;
    }

    // ── Command handlers ──────────────────────────────────────────────────────

    void cmdLook() const {
        currentRoom->display();
        std::cout << "\n";
        player->display();
    }

    void cmdGo(const std::string& dir) {
        if (currentRoom->hasLivingEnemies()) {
            std::cout << "You can't leave while enemies are present! Fight or flee.\n";
            return;
        }

        Room* next = currentRoom->getExit(expandDirection(dir));
        if (!next) {
            std::cout << "You can't go that way.\n";
            return;
        }

        if (next->isLocked()) {
            if (!next->tryUnlock(*player)) {
                std::cout << "The door is locked. You need a "
                          << next->getRequiredKey() << ".\n";
                return;
            }
            std::cout << "You use the " << next->getRequiredKey()
                      << " to unlock the door.\n";
        }

        currentRoom = next;
        cmdLook();

        // Combat triggers automatically on room entry
        if (currentRoom->hasLivingEnemies()) {
            Enemy* enemy = currentRoom->firstLivingEnemy();
            std::cout << "\nAn enemy blocks your path!\n";
            startCombat(enemy);
        }
    }

    void cmdTake(const std::string& itemName) {
        if (itemName.empty()) { std::cout << "Take what?\n"; return; }
        Item* item = currentRoom->takeItem(itemName);
        if (!item) { std::cout << "There's no '" << itemName << "' here.\n"; return; }
        player->addItem(item);
        std::cout << "You pick up the " << item->getName() << ".\n";
        checkWinCondition();
    }

    void cmdDrop(const std::string& itemName) {
        if (itemName.empty()) { std::cout << "Drop what?\n"; return; }
        Item* item = player->findItem(itemName);
        if (!item) { std::cout << "You don't have '" << itemName << "'.\n"; return; }
        if (item == player->getEquippedWeapon()) player->unequipWeapon();
        player->removeItem(itemName);
        currentRoom->addItem(item);
        std::cout << "You drop the " << item->getName() << ".\n";
    }

    void cmdInventory() const {
        player->showInventory();
    }

    void cmdUse(const std::string& itemName) {
        if (itemName.empty()) { std::cout << "Use what?\n"; return; }
        Item* item = player->findItem(itemName);
        if (!item) { std::cout << "You don't have '" << itemName << "'.\n"; return; }

        if (item->getHealAmount() > 0) {
            int healed = std::min(item->getHealAmount(), player->getMaxHp() - player->getHp());
            player->heal(item->getHealAmount());
            std::cout << "You drink the " << item->getName()
                      << " and restore " << healed << " HP. "
                      << "(HP: " << player->getHp() << "/" << player->getMaxHp() << ")\n";
            if (item->isConsumable()) {
                player->removeItem(item->getName());
                std::cout << "The " << item->getName() << " is used up.\n";
            }
        } else if (item->getAttackBonus() > 0) {
            player->equipWeapon(item);
            std::cout << "You equip the " << item->getName()
                      << ". (+" << item->getAttackBonus() << " ATK)\n";
        } else {
            std::cout << "You're not sure how to use the " << item->getName() << " right now.\n";
        }
    }

    void cmdExamine(const std::string& itemName) const {
        if (itemName.empty()) { std::cout << "Examine what?\n"; return; }

        // Check inventory first, then room floor
        Item* item = player->findItem(itemName);
        if (!item) item = currentRoom->findItem(itemName);
        if (!item) {
            std::cout << "You don't see '" << itemName << "' here or in your pack.\n";
            return;
        }
        std::cout << item->getName() << ": " << item->getDescription() << "\n";
    }

    void cmdHelp() const {
        std::cout <<
            "Commands:\n"
            "  look                  — describe current room\n"
            "  go <direction>        — move (north/south/east/west or n/s/e/w)\n"
            "  take <item>           — pick up an item\n"
            "  drop <item>           — drop an item from your pack\n"
            "  inventory  (or inv)   — show your inventory\n"
            "  use <item>            — use or equip an item\n"
            "  examine <item>        — read an item's description\n"
            "  help                  — show this list\n"
            "  quit                  — exit the game\n";
    }

    void cmdQuit() {
        std::cout << "You abandon your quest and slink back to the surface. Farewell.\n";
        running = false;
    }

    // ── Combat ────────────────────────────────────────────────────────────────
    void startCombat(Enemy* enemy) {
        std::cout << "\n*** COMBAT: " << enemy->getName() << " ***\n";
        enemy->display();
        std::cout << "\n";

        while (player->isAlive() && enemy->isAlive()) {
            // --- Player turn ---
            std::cout << "Your HP: " << player->getHp() << "/" << player->getMaxHp()
                      << "  |  " << enemy->getName() << " HP: "
                      << enemy->getHp() << "/" << enemy->getMaxHp() << "\n"
                      << "[1] Attack   [2] Flee   [3] Use item\n> ";

            std::string choice;
            std::getline(std::cin, choice);
            choice = trim(toLower(choice));

            bool enemyTurnFollows = true;

            if (choice == "2" || choice == "flee") {
                if (std::rand() % 2 == 0) {
                    std::cout << "You manage to escape!\n";
                    return;  // flee succeeds — leave combat without moving rooms
                }
                std::cout << "You couldn't escape!\n";
            } else if (choice == "3" || choice == "use item" || choice == "use") {
                // Let the player pick a consumable from their inventory mid-fight
                const auto& inv = player->getInventory();
                std::vector<Item*> usable;
                for (Item* it : inv) {
                    if (it->getHealAmount() > 0) usable.push_back(it);
                }
                if (usable.empty()) {
                    std::cout << "You have no usable items.\n";
                } else {
                    std::cout << "Use which item?\n";
                    for (std::size_t idx = 0; idx < usable.size(); ++idx)
                        std::cout << "  [" << (idx + 1) << "] " << usable[idx]->getName() << "\n";
                    std::cout << "> ";
                    std::string pick;
                    std::getline(std::cin, pick);
                    pick = trim(pick);
                    int sel = 0;
                    try { sel = std::stoi(pick); } catch (...) { sel = 0; }
                    if (sel >= 1 && sel <= static_cast<int>(usable.size())) {
                        Item* chosen = usable[sel - 1];
                        int healed = std::min(chosen->getHealAmount(),
                                              player->getMaxHp() - player->getHp());
                        player->heal(chosen->getHealAmount());
                        std::cout << "You use the " << chosen->getName()
                                  << " and restore " << healed << " HP."
                                  << " (HP: " << player->getHp() << "/" << player->getMaxHp() << ")\n";
                        if (chosen->isConsumable()) player->removeItem(chosen->getName());
                    } else {
                        std::cout << "Never mind.\n";
                        enemyTurnFollows = false;  // no action taken — don't waste enemy turn
                    }
                }
            } else {
                // Default to attack for any other input
                int rawDmg    = player->attack();
                int actualDmg = std::max(0, rawDmg - enemy->getDefense());
                enemy->takeDamage(actualDmg);
                std::cout << "You strike the " << enemy->getName()
                          << " for " << actualDmg << " damage!";
                if (!enemy->isAlive()) std::cout << " It collapses!";
                std::cout << "\n";
            }

            // --- Enemy turn ---
            if (enemyTurnFollows && enemy->isAlive()) {
                int rawDmg    = enemy->attack();
                int actualDmg = std::max(0, rawDmg - player->getDefense());
                player->takeDamage(actualDmg);
                std::cout << enemy->getAttackMessage()
                          << " (-" << actualDmg << " HP)"
                          << "  [Your HP: " << player->getHp() << "]\n";
            }
        }

        if (!player->isAlive()) {
            std::cout << "\nYou have been defeated. Game over.\n";
            running = false;
            return;
        }

        // Enemy defeated
        std::cout << "\nYou defeated the " << enemy->getName() << "!"
                  << " (+" << enemy->getXpReward() << " XP)\n";
        player->gainXp(enemy->getXpReward());
        currentRoom->removeDeadEnemies();
        std::cout << "\n";
    }

    // ── Win condition ─────────────────────────────────────────────────────────
    void checkWinCondition() {
        if (player->hasItem("golden treasure")) {
            std::cout << "\n"
                "╔══════════════════════════════════════╗\n"
                "║          YOU WIN! CONGRATULATIONS    ║\n"
                "╠══════════════════════════════════════╣\n"
                "║  You claimed the golden treasure     ║\n"
                "║  and emerged victorious!             ║\n"
                "╚══════════════════════════════════════╝\n\n";
            player->display();
            running = false;
            won = true;
        }
    }

    // ── Command dispatcher ────────────────────────────────────────────────────
    void processCommand(const std::string& input) {
        if (trim(input).empty()) return;

        auto [verb, rest] = parseCommand(input);

        if (verb == "look"   || verb == "l")              { cmdLook(); }
        else if (verb == "go"|| verb == "move")           { cmdGo(rest); }
        else if (verb == "north"|| verb == "south"
              || verb == "east" || verb == "west"
              || verb == "n"    || verb == "s"
              || verb == "e"    || verb == "w")           { cmdGo(verb); }
        else if (verb == "take" || verb == "get"
              || verb == "pick")                          { cmdTake(rest); }
        else if (verb == "drop" || verb == "discard")     { cmdDrop(rest); }
        else if (verb == "inventory" || verb == "inv"
              || verb == "i")                             { cmdInventory(); }
        else if (verb == "use"  || verb == "equip")       { cmdUse(rest); }
        else if (verb == "examine" || verb == "ex"
              || verb == "inspect" || verb == "look at")  { cmdExamine(rest); }
        else if (verb == "help" || verb == "?")           { cmdHelp(); }
        else if (verb == "quit" || verb == "exit"
              || verb == "q")                             { cmdQuit(); }
        else {
            std::cout << "I don't understand '" << verb << "'. Type 'help' for commands.\n";
        }
    }

public:
    // RAII constructor: sets up the entire game world on the heap
    Game() : player(nullptr), currentRoom(nullptr), running(true), won(false) {
        setupWorld();
    }

    // RAII destructor: Game owns all heap objects and cleans them up here
    ~Game() {
        for (auto* r : allRooms)   delete r;
        for (auto* i : allItems)   delete i;
        for (auto* e : allEnemies) delete e;
        delete player;
    }

    void run() {
        std::cout <<
            "╔══════════════════════════════════════╗\n"
            "║     DUNGEON OF THE SKELETON LORD     ║\n"
            "╚══════════════════════════════════════╝\n\n"
            "You have ventured into an ancient dungeon in search of legendary\n"
            "treasure. Type 'help' to see available commands.\n";

        cmdLook();

        while (running) {
            std::cout << "\n> ";
            std::string line;
            if (!std::getline(std::cin, line)) break;  // handle Ctrl+D / piped input
            processCommand(line);
        }

        if (!won && running == false) {
            // Only print farewell if not already handled by quit/lose/win
        }
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────
int main() {
    std::srand(static_cast<unsigned>(std::time(nullptr)));  // seed random once

    Game game;
    game.run();

    return 0;
}
