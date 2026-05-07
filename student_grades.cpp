// =============================================================
// student_grades.cpp — Struct arrays, pointers, and memory
// =============================================================
//
// MEMORY PRIMER (read this first)
// --------------------------------
// Every variable lives at a memory address. A pointer is a variable
// that *stores* an address rather than a plain value.
//
//   int score = 95;        // score lives at, say, 0x7ffd1000
//   int* p = &score;       // p stores the address 0x7ffd1000
//   *p = 100;              // dereference p → writes 100 into score
//
// Passing a pointer to a function lets the function read/write the
// original data without copying it — essential for large structs.
// =============================================================

#include <iostream>
#include <string>
#include <iomanip>

// -------------------------------------------------------------
// STRUCT LAYOUT IN MEMORY
// -------------------------------------------------------------
// A struct packs its fields contiguously. For an array of Student,
// the layout looks like:
//
//   [ name(32B) | grade(4B) | pad(4B?) ] [ name(32B) | grade(4B) | ... ]
//   ^--- students[0] ---^               ^--- students[1] ---^
//
// &students[1] == &students[0] + sizeof(Student)  (pointer arithmetic)
// -------------------------------------------------------------
struct Student {
    std::string name;
    double      grade;
};

// -------------------------------------------------------------
// calculateAverage
// -------------------------------------------------------------
// Receives a *const pointer* to the first element of the array and
// the number of elements. We never copy the array — just its address.
//
// Why `const Student*`?  The function promises it won't modify the
// data behind the pointer. The compiler enforces this.
//
// Pointer arithmetic:  (arr + i) is the address of the i-th Student.
// *(arr + i) dereferences it — identical to arr[i], which the
// compiler rewrites as *(arr + i) internally.
// -------------------------------------------------------------
double calculateAverage(const Student* arr, int count) {
    double sum = 0.0;
    for (int i = 0; i < count; ++i) {
        sum += arr[i].grade;   // arr[i]  ≡  *(arr + i)
    }
    return sum / count;
}

// -------------------------------------------------------------
// findHighest / findLowest
// -------------------------------------------------------------
// Returns a pointer to the Student with the extreme grade rather
// than copying the struct out. The caller can then read any field
// through the returned pointer (result->name, result->grade).
//
// Returning `const Student*` keeps the caller from accidentally
// modifying the original array element through the pointer.
// -------------------------------------------------------------
const Student* findHighest(const Student* arr, int count) {
    const Student* best = arr;          // start: pointer to element 0
    for (int i = 1; i < count; ++i) {
        if (arr[i].grade > best->grade) {
            best = arr + i;             // point to the new best
        }
    }
    return best;
}

const Student* findLowest(const Student* arr, int count) {
    const Student* worst = arr;
    for (int i = 1; i < count; ++i) {
        if (arr[i].grade < worst->grade) {
            worst = arr + i;
        }
    }
    return worst;
}

// -------------------------------------------------------------
// letterGrade
// -------------------------------------------------------------
// Takes a plain double by value — no pointer needed for a small
// primitive. Returning a string literal is fine; the compiler
// stores them in read-only memory for the program's lifetime.
// -------------------------------------------------------------
std::string letterGrade(double grade) {
    if (grade >= 90.0) return "A";
    if (grade >= 80.0) return "B";
    if (grade >= 70.0) return "C";
    if (grade >= 60.0) return "D";
    return "F";
}

// -------------------------------------------------------------
// displayReport
// -------------------------------------------------------------
// Receives a const pointer: reads but never writes.
// The `->` operator dereferences a pointer and accesses a member
// in one step:  ptr->name  ≡  (*ptr).name
// -------------------------------------------------------------
void displayReport(const Student* arr, int count) {
    std::cout << "\n=== Student Report ===\n";
    std::cout << std::left
              << std::setw(20) << "Name"
              << std::setw(10) << "Grade"
              << "Letter\n";
    std::cout << std::string(36, '-') << '\n';

    for (int i = 0; i < count; ++i) {
        std::cout << std::setw(20) << arr[i].name
                  << std::setw(10) << std::fixed << std::setprecision(1)
                  << arr[i].grade
                  << letterGrade(arr[i].grade) << '\n';
    }

    // ---- statistics ----
    double avg          = calculateAverage(arr, count);
    const Student* high = findHighest(arr, count);
    const Student* low  = findLowest(arr, count);

    std::cout << std::string(36, '-') << '\n';
    std::cout << "Average : " << std::fixed << std::setprecision(2)
              << avg << "  (" << letterGrade(avg) << ")\n";
    // high and low are pointers; -> reaches into the struct they point at
    std::cout << "Highest : " << high->name << " — " << high->grade << '\n';
    std::cout << "Lowest  : " << low->name  << " — " << low->grade  << '\n';
}

// =============================================================
// POINTER DEMO  — addresses and dereferencing, printed live
// =============================================================
void pointerDemo(Student* arr, int count) {
    std::cout << "\n=== Pointer / Memory Demo ===\n";

    // sizeof tells us how many bytes one Student occupies
    std::cout << "sizeof(Student)  = " << sizeof(Student) << " bytes\n";
    std::cout << "sizeof(arr[0])   = " << sizeof(arr[0])  << " bytes\n\n";

    // Print the raw address of each element.  Because the struct array
    // is laid out contiguously, addresses advance by sizeof(Student).
    for (int i = 0; i < count; ++i) {
        std::cout << "arr[" << i << "]  address = "
                  << static_cast<void*>(arr + i)
                  << "  name = " << (arr + i)->name << '\n';
    }

    // Modifying a value through a pointer:
    Student* first = arr;              // first points to arr[0]
    std::cout << "\nBefore: arr[0].grade = " << arr[0].grade << '\n';
    first->grade = arr[0].grade + 0.1; // tiny nudge via pointer
    std::cout << "After  (via pointer): arr[0].grade = " << arr[0].grade << '\n';
    first->grade -= 0.1;               // restore

    // NULL / nullptr — a pointer that points nowhere.
    // Always initialise pointers; an uninitialised pointer is undefined behaviour.
    Student* nobody = nullptr;
    std::cout << "\nnobody (nullptr) = " << nobody << '\n';
    // Dereferencing nobody would crash — never do `*nobody` or `nobody->grade`.
}

// =============================================================
// main
// =============================================================
int main() {
    // Stack-allocated array of structs.  No `new`/`delete` needed;
    // the OS reclaims the stack frame when main() returns.
    Student students[] = {
        {"Alice",   92.5},
        {"Bob",     78.3},
        {"Charlie", 85.0},
        {"Diana",   61.7},
        {"Ethan",   55.4},
    };

    // Array size without a magic number:
    //   sizeof(students)          → total bytes for the whole array
    //   sizeof(students[0])       → bytes for one element
    //   dividing gives element count
    int count = static_cast<int>(sizeof(students) / sizeof(students[0]));

    // When we pass `students` to a function, C++ decays the array
    // to a pointer to its first element — no copying occurs.
    //   displayReport(students, count)
    //   ≡ displayReport(&students[0], count)
    displayReport(students, count);
    pointerDemo(students, count);

    return 0;
}
