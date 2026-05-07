// calculator.cpp
// A beginner-friendly command-line calculator in C++
// Supports: addition, subtraction, multiplication, division, modulo
// Type 'exit' to quit the program

#include <iostream>  // Provides cin and cout for reading input and printing output
#include <string>    // Provides the string type for reading text like "exit"
#include <limits>    // Provides numeric_limits, used to clear bad input from cin

// ─── Operation Functions ──────────────────────────────────────────────────────
// Each function takes two doubles (decimal numbers) and returns the result.
// Using separate functions keeps the code organised and easy to test.

// Returns the sum of a and b
double add(double a, double b) {
    return a + b;  // The + operator adds the two numbers together
}

// Returns the difference of a minus b
double subtract(double a, double b) {
    return a - b;  // The - operator subtracts b from a
}

// Returns the product of a and b
double multiply(double a, double b) {
    return a * b;  // The * operator multiplies the two numbers
}

// Returns a divided by b, or signals an error if b is zero.
// The bool& parameter is an output flag: the caller sets it to true if an
// error occurred, so it can print a message without the function doing I/O.
double divide(double a, double b, bool& error) {
    if (b == 0) {          // Division by zero is mathematically undefined
        error = true;      // Tell the caller something went wrong
        return 0;          // Return a dummy value; caller will ignore it
    }
    error = false;         // No error — division is safe to perform
    return a / b;          // The / operator divides a by b
}

// Returns a modulo b (the integer remainder after dividing a by b).
// Modulo is only meaningful for whole numbers, so we cast to int first.
// Same error-flag pattern as divide() to handle the zero case.
int modulo(int a, int b, bool& error) {
    if (b == 0) {          // Modulo by zero is also undefined
        error = true;
        return 0;
    }
    error = false;
    return a % b;          // The % operator gives the remainder of integer division
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Prints a short usage guide so the user knows what to type
void printHelp() {
    std::cout << "\n  Operators: +  -  *  /  %\n";
    std::cout << "  Example  : 10 / 3\n";
    std::cout << "  Quit     : exit\n\n";
}

// ─── Main Loop ────────────────────────────────────────────────────────────────

int main() {
    // std::string stores a sequence of characters — perfect for reading a whole word
    std::string input;

    std::cout << "=== C++ Command-Line Calculator ===";
    printHelp();  // Show the cheat-sheet on start-up

    // An infinite loop that runs forever until we explicitly break out of it
    while (true) {

        // Print a prompt so the user knows the program is waiting for input
        std::cout << "calc> ";

        // Read the first token the user types.
        // cin >> reads whitespace-delimited tokens (words / numbers).
        std::cin >> input;

        // Compare the input to the word "exit" (case-sensitive).
        // If they match, break exits the while loop and ends the program.
        if (input == "exit") {
            std::cout << "Goodbye!\n";
            break;  // Jump out of the while loop — next line after } runs next
        }

        // We expect a number next. Try converting the string to a double.
        // stod() = "string to double"; throws std::invalid_argument on failure.
        double a;          // Will hold the left-hand operand
        try {
            a = std::stod(input);   // Convert the first token to a number
        } catch (...) {
            // The user typed something that isn't a number or "exit"
            std::cout << "  Error: '" << input << "' is not a number or 'exit'.\n";
            // cin may still have leftover characters — discard the rest of the line
            std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
            continue;  // Skip the rest of this loop iteration and ask again
        }

        // Read the operator character (+, -, *, /, %)
        char op;           // char holds a single character
        std::cin >> op;

        // Read the right-hand operand
        double b;
        if (!(std::cin >> b)) {
            // If reading b fails (e.g. user typed letters), report the error
            std::cout << "  Error: second operand is not a valid number.\n";
            // Clear the error state on cin so it can be used again
            std::cin.clear();
            std::cin.ignore(std::numeric_limits<std::streamsize>::max(), '\n');
            continue;
        }

        // A flag variable we pass to divide() and modulo() to detect errors
        bool error = false;

        // Use a switch to choose the correct function based on the operator
        switch (op) {

            case '+':
                // Call add() and print the result
                std::cout << "  = " << add(a, b) << "\n";
                break;  // break exits the switch; without it, execution falls through

            case '-':
                std::cout << "  = " << subtract(a, b) << "\n";
                break;

            case '*':
                std::cout << "  = " << multiply(a, b) << "\n";
                break;

            case '/': {
                // Curly braces create a new scope so 'result' only lives here
                double result = divide(a, b, error);
                if (error) {
                    std::cout << "  Error: division by zero is undefined.\n";
                } else {
                    std::cout << "  = " << result << "\n";
                }
                break;
            }

            case '%': {
                // Modulo works on integers, so cast both operands with (int)
                int result = modulo(static_cast<int>(a), static_cast<int>(b), error);
                if (error) {
                    std::cout << "  Error: modulo by zero is undefined.\n";
                } else {
                    // Remind the user that decimal parts were truncated
                    std::cout << "  = " << result
                              << "  (integer remainder; decimals truncated)\n";
                }
                break;
            }

            default:
                // The user entered an operator we don't recognise
                std::cout << "  Error: unknown operator '" << op
                          << "'. Use +  -  *  /  %\n";
                break;
        }
    }  // End of while loop — go back to "calc> " prompt

    return 0;  // Return 0 to the OS to signal the program finished successfully
}
