# Synthetic Fixtures

These fixtures are synthetic and safe for Git. They exist before implementation
so backend and frontend agents can test the same expected behavior without using
partner Excel rows.

Use `replenishment_scenarios.json` as the source of expected arithmetic. Each
scenario has explicit inputs, expected flags, and expected recommendation
numbers. Real partner data can only complement these checks; it must not replace
them because several required cases are not confirmed in the source files.
