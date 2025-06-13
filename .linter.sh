#!/bin/bash
cd /home/kavia/workspace/code-generation/tictactoeweb-27923-53274129/tic-tac-toe
source venv/bin/activate
flake8 .
LINT_EXIT_CODE=$?
if [ $LINT_EXIT_CODE -ne 0 ]; then
  exit 1
fi

