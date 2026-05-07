// ============================================================
// Text Adventure Game — demonstrates core C++ OOP concepts:
//   Encapsulation, Inheritance, Polymorphism, Abstract Classes,
//   Composition, and RAII.
// Compile: g++ -std=c++17 -Wall -Wextra -o game game.cpp
// Run:     ./game
// ============================================================

#include <algorithm>
#include <iostream>
#include <map>
#include <sstream>
#include <string>
#include <vector>
#include <cstdlib>
#include <ctime>

// Forward declarations needed because Room references Enemy and Item
// before those classes are fully defined.
class Room;
class Enemy;
class Item;

// ============================================================
// ABSTRACT BASE CLASS: Entity
//
// OOP — Encapsulation: name and description are protected so
// subclasses can read them, but external code must use getters.
//
// OOP — Abstract class: display() is a pure virtual function.
// Any class that inherits Entity MUST override display(), or
// it also becomes abstract and cannot be instantiated.
// ============================================================
class Entity {
protected:
    std::string name;
    std::string description;

public:
    Entity(const std::string& n, const std::string& d)
        : name(n), description(d) {}

    virtual ~Entity() = default;

    const std::string& getName()        const { return name; }
    const std::string& getDescription() const { return description; }

    // OOP — Polymorphism (runtime): the correct display() is chosen
    // at runtime based on the actual object type, not the pointer type.
    virtual void display() const = 0;
};


// ============================================================
// CLASS: Item
//
// OOP — Inheritance: Item IS-A Entity (inherits name + description).
// OOP — Encapsulation: internal fields (healAmount, etc.) are
// private; callers use getters.
// ============================================================
class Item : public Entity {
private:
    int  healAmount;   // HP restored when used (0 = not a potion)
    int  attackBonus;  // Extra attack when equipped (0 = not a weapon)
    bool consumable;   // Removed from inventory after use?
    bool equipped;     // Is the player currently wielding this?

public:
    Item(const std::string& n, const std::string& d,
         int heal, int atkBonus, bool consume)
        : Entity(n, d)
        , healAmount(heal)
        , attackBonus(atkBonus)
        , consumable(consume)
        , equipped(false)
    {}

    int  getHealAmount()  const { return healAmount; }
    int  getAttackBonus() const { return attackBonus; }
    bool isConsumable()   const { return consumable; }
    bool isEquipped()     const { return equipped; }
    void setEquipped(bool state) { equipped = state; }

    // OOP — Polymorphism: overrides the pure virtual from Entity.
    void display() const override {
        std::cout << "  [item] " << name;
        if (attackBonus > 0) std::cout << " (weapon, +" << attackBonus << " atk)";
        if (healAmount  > 0) std::cout << " (heals "    << healAmount  << " hp)";
        if (equipped)        std::cout << " <equipped>";
        std::cout << "\n         " << description << "\n";
    }
};


// ============================================================
// ABSTRACT CLASS: Combatant
//
// OOP — Inheritance: Combatant IS-A Entity.
// OOP — Abstract class: attack() is pure virtual. Both Player
// and Enemy inherit Combatant and each computes damage differently.
// Combatant knows how to take damage but not how to deal it.
// ============================================================
class Combatant : public Entity {
protected:
    int hp;
    int maxHp;
    int baseAttack;
    int defense;

public:
    Combatant(const std::string& n, const std::string& d,
              int hp_, int atk, int def)
        : Entity(n, d)
        , hp(hp_), maxHp(hp_), baseAttack(atk), defense(def)
    {}

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

    // OOP — Polymorphism (pure virtual): subclasses define exactly
    // how they roll their attack damage.
    virtual int  attack()        = 0;
    virtual void display() const = 0;
};


// ============================================================
// CLASS: Enemy
//
// OOP — Inheritance: Enemy IS-A Combatant IS-A Entity.
// ============================================================
class Enemy : public Combatant {
private:
    int         xpReward;
    std::string attackMessage;

public:
    Enemy(const std::string& n, const std::string& d,
          int hp, int atk, int def, int xp, const std::string& msg)
        : Combatant(n, d, hp, atk, def)
        , xpReward(xp)
        , attackMessage(msg)
    {}

    int                getXpReward()      const { return xpReward; }
    const std::string& getAttackMessage() const { return attackMessage; }

    // OOP — Polymorphism: overrides pure virtual from Combatant.
    // Enemy attack has a small random component.
    int attack() override {
        return baseAttack + (std::rand() % 3);
    }

    void display() const override {
        std::cout << "  [enemy] " << name
                  << "  HP: " << hp << "/" << maxHp
                  << "  ATK: " << baseAttack
                  << "  DEF: " << defense << "\n"
                  << "         " << description << "\n";
    }
};


// ============================================================
// CLASS: Player
//
// OOP — Inheritance: Player IS-A Combatant IS-A Entity.
// OOP — Composition: Player HAS-A vector of Item pointers
//   (the inventory). The vector is part of the Player's state.
// ============================================================
class Player : public Combatant {
private:
    // OOP — Composition + Encapsulation: inventory is an internal
    // data structure managed exclusively through Player methods.
    std::vector<Item*> inventory;
    Item* equippedWeapon;   // nullptr when unarmed
    int   xp;

public:
    explicit Player(const std::string& n)
        : Combatant(n, "The hero of our story.", 50, 5, 2)
        , equippedWeapon(nullptr)
        , xp(0)
    {}

    // --- Inventory management ---

    void addItem(Item* item) {
        inventory.push_back(item);
    }

    // Returns the pointer (caller does NOT take ownership) or nullptr.
    Item* findItem(const std::string& itemName) const {
        auto it = std::find_if(inventory.begin(), inventory.end(),
            [&](Item* i) { return i->getName() == itemName; });
        return (it != inventory.end()) ? *it : nullptr;
    }

    bool hasItem(const std::string& itemName) const {
        return findItem(itemName) != nullptr;
    }

    // Removes item from inventory (does NOT delete it — Game owns memory).
    // Returns true on success.
    bool removeItem(const std::string& itemName) {
        auto it = std::find_if(inventory.begin(), inventory.end(),
            [&](Item* i) { return i->getName() == itemName; });
        if (it == inventory.end()) return false;
        if (*it == equippedWeapon) equippedWeapon = nullptr;
        inventory.erase(it);
        return true;
    }

    const std::vector<Item*>& getInventory() const { return inventory; }

    // --- Equipment ---

    bool equipWeapon(Item* item) {
        if (item->getAttackBonus() <= 0) return false;
        if (equippedWeapon) equippedWeapon->setEquipped(false);
        equippedWeapon = item;
        equippedWeapon->setEquipped(true);
        return true;
    }

    Item* getEquippedWeapon() const { return equippedWeapon; }

    // --- XP ---

    void gainXp(int amount) { xp += amount; }
    int  getXp()       const { return xp; }

    // OOP — Polymorphism: overrides Combatant::attack().
    // Adds equipped weapon bonus on top of base attack.
    int attack() override {
        int bonus = equippedWeapon ? equippedWeapon->getAttackBonus() : 0;
        return baseAttack + bonus + (std::rand() % 4);
    }

    void display() const override {
        std::cout << "  " << name
                  << "  HP: " << hp << "/" << maxHp
                  << "  ATK: " << baseAttack;
        if (equippedWeapon)
            std::cout << " (+" << equippedWeapon->getAttackBonus() << " weapon)";
        std::cout << "  DEF: " << defense
                  << "  XP: "  << xp << "\n";
    }

    void showInventory() const {
        if (inventory.empty()) {
            std::cout << "Your inventory is empty.\n";
            return;
        }
        std::cout << "Inventory (" << inventory.size() << " item"
                  << (inventory.size() == 1 ? "" : "s") << "):\n";
        for (const Item* item : inventory) {
            item->display();
        }
    }
};


// ============================================================
// CLASS: Room
//
// OOP — Inheritance: Room IS-A Entity.
// OOP — Composition: Room HAS-A map of exits, a vector of items,
//   and a vector of enemies. These make up the room's structure.
// OOP — Encapsulation: the containers are private; callers use
//   named methods (addExit, getExit, etc.) rather than touching
//   the map/vectors directly.
// ============================================================
class Room : public Entity {
private:
    std::map<std::string, Room*> exits;   // direction -> Room*
    std::vector<Item*>  items;            // items currently on the floor
    std::vector<Enemy*> enemies;          // enemies currently in the room
    bool        locked;
    std::string requiredKey;              // item name needed to unlock

public:
    Room(const std::string& n, const std::string& d,
         bool lk = false, const std::string& key = "")
        : Entity(n, d), locked(lk), requiredKey(key)
    {}

    // --- Exits ---

    void  addExit(const std::string& dir, Room* room) { exits[dir] = room; }
    Room* getExit(const std::string& dir) const {
        auto it = exits.find(dir);
        return (it != exits.end()) ? it->second : nullptr;
    }
    const std::map<std::string, Room*>& getExits() const { return exits; }

    // --- Items ---

    void addItem(Item* item) { items.push_back(item); }

    // Removes item from the floor and returns its pointer (caller takes it).
    Item* takeItem(const std::string& itemName) {
        auto it = std::find_if(items.begin(), items.end(),
            [&](Item* i) { return i->getName() == itemName; });
        if (it == items.end()) return nullptr;
        Item* item = *it;
        items.erase(it);
        return item;
    }

    Item* findItem(const std::string& itemName) const {
        auto it = std::find_if(items.begin(), items.end(),
            [&](Item* i) { return i->getName() == itemName; });
        return (it != items.end()) ? *it : nullptr;
    }

    const std::vector<Item*>& getItems() const { return items; }

    // --- Enemies ---

    void addEnemy(Enemy* e) { enemies.push_back(e); }

    // Removes dead enemies from the room list (does NOT delete them).
    void removeDeadEnemies() {
        enemies.erase(
            std::remove_if(enemies.begin(), enemies.end(),
                [](Enemy* e) { return !e->isAlive(); }),
            enemies.end());
    }

    const std::vector<Enemy*>& getEnemies() const { return enemies; }

    bool hasLivingEnemies() const {
        return std::any_of(enemies.begin(), enemies.end(),
            [](Enemy* e) { return e->isAlive(); });
    }

    Enemy* firstLivingEnemy() const {
        for (Enemy* e : enemies)
            if (e->isAlive()) return e;
        return nullptr;
    }

    // --- Lock ---

    bool isLocked() const { return locked; }

    // Returns true if the provided key name matches and unlocks the room.
    bool tryUnlock(const std::string& keyName) {
        if (locked && keyName == requiredKey) {
            locked = false;
            return true;
        }
        return false;
    }

    const std::string& getRequiredKey() const { return requiredKey; }

    // OOP — Polymorphism: overrides Entity::display() with room-specific output.
    void display() const override {
        std::cout << "\n=== " << name << " ===\n";
        std::cout << description << "\n";

        if (!items.empty()) {
            std::cout << "\nYou see:\n";
            for (const Item* item : items) item->display();
        }

        if (hasLivingEnemies()) {
            std::cout << "\nEnemies present:\n";
            for (const Enemy* e : enemies)
                if (e->isAlive()) e->display();
        }

        std::cout << "\nExits: ";
        bool first = true;
        for (const auto& [dir, room] : exits) {
            if (!first) std::cout << ", ";
            std::cout << dir;
            if (room->isLocked()) std::cout << " (locked)";
            first = false;
        }
        std::cout << "\n";
    }
};


// ============================================================
// CLASS: Game
//
// OOP — Composition: Game owns all objects (rooms, items, enemies,
//   player). It is the single point of allocation and deallocation.
// OOP — RAII: the destructor cleans up all heap memory so there
//   are no leaks when the game ends.
// ============================================================
class Game {
private:
    Player* player;
    Room*   currentRoom;

    // Game owns all heap objects; other classes only borrow pointers.
    std::vector<Room*>  allRooms;
    std::vector<Item*>  allItems;
    std::vector<Enemy*> allEnemies;

    bool running;
    bool won;

    // ----------------------------------------------------------
    // World construction
    // ----------------------------------------------------------
    void setupWorld() {
        // --- Items ---
        auto* potion    = new Item("health potion",
                                   "A small vial of shimmering red liquid.",
                                   30, 0, true);
        auto* rustyKey  = new Item("rusty key",
                                   "An old iron key caked in rust. It might still work.",
                                   0, 0, false);
        auto* ironSword = new Item("iron sword",
                                   "A well-balanced sword, nicked but reliable.",
                                   0, 8, false);
        auto* treasure  = new Item("golden treasure",
                                   "A glittering chest overflowing with gold coins. You've done it!",
                                   0, 0, false);

        allItems = {potion, rustyKey, ironSword, treasure};

        // --- Enemies ---
        auto* guard = new Enemy(
            "guard",
            "A bored armory guard who perks up at the sight of an intruder.",
            25, 6, 2, 15,
            "The Guard swings a rusty blade at you!");

        auto* skeletonLord = new Enemy(
            "skeleton lord",
            "A towering skeleton in black armor. Its eye sockets glow red.",
            45, 10, 3, 50,
            "The Skeleton Lord's bony fist crashes into you!");

        allEnemies = {guard, skeletonLord};

        // --- Rooms ---
        auto* entranceHall = new Room(
            "Entrance Hall",
            "You stand in a cold stone hall. Torchlight flickers on the walls.\n"
            "A passage leads east to the armory. A heavy door to the north\n"
            "bears a large iron lock.");

        auto* armory = new Room(
            "Armory",
            "Racks of weapons line the walls, most rusted beyond use.\n"
            "Something useful might still be here.");

        auto* dungeon = new Room(
            "Dungeon",
            "A damp, dark chamber. Bones litter the floor.\n"
            "In the far corner glints something extraordinary.",
            true, "rusty key");   // locked — needs rusty key

        allRooms = {entranceHall, armory, dungeon};

        // --- Place items in rooms ---
        entranceHall->addItem(potion);
        armory->addItem(rustyKey);
        armory->addItem(ironSword);
        dungeon->addItem(treasure);

        // --- Place enemies in rooms ---
        armory->addEnemy(guard);
        dungeon->addEnemy(skeletonLord);

        // --- Wire exits ---
        entranceHall->addExit("east",  armory);
        entranceHall->addExit("north", dungeon);
        armory->addExit("west",  entranceHall);
        dungeon->addExit("south", entranceHall);

        // --- Create player ---
        player = new Player("Hero");

        currentRoom = entranceHall;
    }

    // ----------------------------------------------------------
    // Input parsing helpers
    // ----------------------------------------------------------
    static std::string trim(const std::string& s) {
        const std::string ws = " \t\r\n";
        size_t start = s.find_first_not_of(ws);
        if (start == std::string::npos) return "";
        size_t end = s.find_last_not_of(ws);
        return s.substr(start, end - start + 1);
    }

    static std::string toLower(std::string s) {
        std::transform(s.begin(), s.end(), s.begin(), ::tolower);
        return s;
    }

    // Returns {verb, rest} both lowercased and trimmed.
    static std::pair<std::string, std::string> parseCommand(const std::string& raw) {
        std::string input = toLower(trim(raw));
        size_t sp = input.find(' ');
        if (sp == std::string::npos) return {input, ""};
        return {input.substr(0, sp), trim(input.substr(sp + 1))};
    }

    // Expands single-letter direction abbreviations.
    static std::string expandDirection(const std::string& d) {
        if (d == "n") return "north";
        if (d == "s") return "south";
        if (d == "e") return "east";
        if (d == "w") return "west";
        return d;
    }

    // ----------------------------------------------------------
    // Command handlers
    // ----------------------------------------------------------
    void cmdLook() const {
        currentRoom->display();
    }

    void cmdGo(const std::string& rawDir) {
        if (rawDir.empty()) { std::cout << "Go where?\n"; return; }

        // Block movement while enemies are alive in this room.
        if (currentRoom->hasLivingEnemies()) {
            std::cout << "You can't leave while enemies are present!\n";
            return;
        }

        std::string dir = expandDirection(rawDir);
        Room* next = currentRoom->getExit(dir);
        if (!next) { std::cout << "You can't go that way.\n"; return; }

        if (next->isLocked()) {
            // Try every key in the player's inventory to unlock the door.
            bool unlocked = false;
            for (Item* item : player->getInventory()) {
                if (next->tryUnlock(item->getName())) {
                    std::cout << "You use the " << item->getName()
                              << " to unlock the door.\n";
                    unlocked = true;
                    break;
                }
            }
            if (!unlocked) {
                std::cout << "The door is locked. You need: "
                          << next->getRequiredKey() << ".\n";
                return;
            }
        }

        currentRoom = next;
        cmdLook();

        // Trigger combat automatically on room entry if enemies are present.
        if (currentRoom->hasLivingEnemies()) {
            Enemy* e = currentRoom->firstLivingEnemy();
            std::cout << "\nAn enemy blocks your path!\n";
            startCombat(e);
        }
    }

    void cmdTake(const std::string& itemName) {
        if (itemName.empty()) { std::cout << "Take what?\n"; return; }
        Item* item = currentRoom->takeItem(itemName);
        if (!item) { std::cout << "You don't see a '" << itemName << "' here.\n"; return; }
        player->addItem(item);
        std::cout << "You pick up the " << item->getName() << ".\n";
    }

    void cmdDrop(const std::string& itemName) {
        if (itemName.empty()) { std::cout << "Drop what?\n"; return; }
        Item* item = player->findItem(itemName);
        if (!item) { std::cout << "You don't have a '" << itemName << "'.\n"; return; }
        player->removeItem(itemName);
        currentRoom->addItem(item);
        std::cout << "You drop the " << item->getName() << ".\n";
    }

    void cmdInventory() const {
        player->display();
        player->showInventory();
    }

    void cmdUse(const std::string& itemName) {
        if (itemName.empty()) { std::cout << "Use what?\n"; return; }
        Item* item = player->findItem(itemName);
        if (!item) { std::cout << "You don't have a '" << itemName << "'.\n"; return; }

        if (item->getHealAmount() > 0) {
            int before = player->getHp();
            player->heal(item->getHealAmount());
            std::cout << "You drink the " << item->getName()
                      << " and recover " << (player->getHp() - before) << " HP. "
                      << "HP: " << player->getHp() << "/" << player->getMaxHp() << "\n";
            if (item->isConsumable()) player->removeItem(item->getName());

        } else if (item->getAttackBonus() > 0) {
            if (player->equipWeapon(item)) {
                std::cout << "You equip the " << item->getName()
                          << ". (+" << item->getAttackBonus() << " attack)\n";
            }

        } else {
            std::cout << "You can't use the " << item->getName() << " that way.\n";
        }
    }

    void cmdExamine(const std::string& itemName) const {
        if (itemName.empty()) { std::cout << "Examine what?\n"; return; }

        // Check player inventory first, then the room floor.
        Item* item = player->findItem(itemName);
        if (!item) item = currentRoom->findItem(itemName);
        if (item) { item->display(); return; }

        // Also check room enemies by name.
        for (Enemy* e : currentRoom->getEnemies())
            if (e->getName() == itemName) { e->display(); return; }

        std::cout << "You don't see a '" << itemName << "' here.\n";
    }

    void cmdHelp() const {
        std::cout << "\nCommands:\n"
                  << "  look               - describe the current room\n"
                  << "  go <dir>           - move (north/south/east/west or n/s/e/w)\n"
                  << "  take <item>        - pick up an item\n"
                  << "  drop <item>        - drop an item\n"
                  << "  inventory (inv)    - show your items and stats\n"
                  << "  use <item>         - drink a potion or equip a weapon\n"
                  << "  examine <thing>    - inspect an item or enemy\n"
                  << "  help               - show this list\n"
                  << "  quit               - exit the game\n\n"
                  << "Objective: find the golden treasure in the dungeon.\n";
    }

    void cmdQuit() {
        std::cout << "Farewell, adventurer.\n";
        running = false;
    }

    // ----------------------------------------------------------
    // Combat
    // ----------------------------------------------------------
    void startCombat(Enemy* enemy) {
        std::cout << "\n*** COMBAT: " << enemy->getName() << " ***\n";
        enemy->display();

        while (player->isAlive() && enemy->isAlive()) {
            // Player's turn
            std::cout << "\n[HP: " << player->getHp() << "/" << player->getMaxHp()
                      << "]  [1] Attack  [2] Flee\n> ";

            std::string choice;
            if (!std::getline(std::cin, choice)) { running = false; return; }
            choice = toLower(trim(choice));

            if (choice == "2" || choice == "flee") {
                if (std::rand() % 2 == 0) {
                    std::cout << "You manage to flee!\n";
                    // Move to the first available exit.
                    for (const auto& [dir, room] : currentRoom->getExits()) {
                        currentRoom = room;
                        std::cout << "You scramble into the " << currentRoom->getName() << ".\n";
                        break;
                    }
                    return;
                }
                std::cout << "You couldn't escape!\n";

            } else {
                // Default to attack for any other input.
                int raw    = player->attack();
                int damage = std::max(0, raw - enemy->getDefense());
                enemy->takeDamage(damage);
                std::cout << "You hit the " << enemy->getName()
                          << " for " << damage << " damage!"
                          << "  (Enemy HP: " << enemy->getHp() << ")\n";
            }

            if (!enemy->isAlive()) break;

            // Enemy's turn
            int raw    = enemy->attack();
            int damage = std::max(0, raw - player->getDefense());
            player->takeDamage(damage);
            std::cout << enemy->getAttackMessage()
                      << " (-" << damage << " HP)"
                      << "  [Your HP: " << player->getHp() << "]\n";
        }

        if (!player->isAlive()) {
            std::cout << "\nYou have been defeated. Game over.\n";
            running = false;
            return;
        }

        // Enemy defeated
        std::cout << "\nYou defeated the " << enemy->getName()
                  << "! +" << enemy->getXpReward() << " XP\n";
        player->gainXp(enemy->getXpReward());
        currentRoom->removeDeadEnemies();
    }

    // ----------------------------------------------------------
    // Win condition check (called after every command)
    // ----------------------------------------------------------
    void checkWinCondition() {
        if (!running) return;
        if (player->hasItem("golden treasure")) {
            std::cout << "\n+--------------------------------------+\n"
                      << "|  YOU WIN! The treasure is yours!     |\n"
                      << "+--------------------------------------+\n"
                      << "Total XP earned: " << player->getXp() << "\n"
                      << "Final HP: " << player->getHp() << "/" << player->getMaxHp() << "\n\n"
                      << "Congratulations, " << player->getName() << "!\n";
            running = false;
            won     = true;
        }
    }

    // ----------------------------------------------------------
    // Command dispatch
    // ----------------------------------------------------------
    void processCommand(const std::string& input) {
        auto [verb, rest] = parseCommand(input);

        if (verb.empty())                                  return;
        if (verb == "look"   || verb == "l")               cmdLook();
        else if (verb == "go" || verb == "move")           cmdGo(rest);
        else if (verb == "north" || verb == "south" ||
                 verb == "east"  || verb == "west"  ||
                 verb == "n"     || verb == "s"     ||
                 verb == "e"     || verb == "w")            cmdGo(verb);
        else if (verb == "take" || verb == "get"  ||
                 verb == "pick")                            cmdTake(rest);
        else if (verb == "drop")                            cmdDrop(rest);
        else if (verb == "inventory" || verb == "inv" ||
                 verb == "i")                               cmdInventory();
        else if (verb == "use" || verb == "equip")         cmdUse(rest);
        else if (verb == "examine" || verb == "x" ||
                 verb == "inspect")                         cmdExamine(rest);
        else if (verb == "help" || verb == "?")            cmdHelp();
        else if (verb == "quit" || verb == "exit" ||
                 verb == "q")                               cmdQuit();
        else
            std::cout << "I don't understand '" << verb
                      << "'. Type 'help' for commands.\n";
    }

public:
    Game() : player(nullptr), currentRoom(nullptr), running(false), won(false) {
        setupWorld();
    }

    // OOP — RAII: destructor releases all heap memory allocated in setupWorld().
    // Called automatically when the Game object goes out of scope in main().
    ~Game() {
        for (Room*  r : allRooms)   delete r;
        for (Item*  i : allItems)   delete i;
        for (Enemy* e : allEnemies) delete e;
        delete player;
    }

    void run() {
        running = true;

        std::cout << "+------------------------------------------+\n"
                  << "|     DUNGEON OF THE SKELETON LORD         |\n"
                  << "|          A Text Adventure                |\n"
                  << "+------------------------------------------+\n\n"
                  << "You are an adventurer who has heard tales of a golden\n"
                  << "treasure buried in the dungeon beneath this castle.\n"
                  << "Find it and claim it as your own -- if you survive.\n"
                  << "\nType 'help' for a list of commands.\n";

        cmdLook();

        while (running) {
            std::cout << "\n> ";
            std::string line;
            if (!std::getline(std::cin, line)) break;   // EOF (Ctrl+D)
            processCommand(line);
            checkWinCondition();
        }

        if (!won && !running)
            std::cout << "\nThanks for playing!\n";
    }
};


// ============================================================
// ENTRY POINT
// ============================================================
int main() {
    // Seed the random number generator once at startup.
    std::srand(static_cast<unsigned>(std::time(nullptr)));

    // OOP — RAII: Game is constructed on the stack. Its destructor
    // runs automatically when main() returns, freeing all memory.
    Game game;
    game.run();

    return 0;
}
