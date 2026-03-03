# KTZ Telegram Bot / КТЖ Телеграм Бот

Professional customer service bot for "АО КТЖ".

## Features
- **Trilingual Support**: Kazakh, Russian, English.
- **Complex Routing**: Automatically forwards complaints and reports to specific departments (CPO, Filial, Ticket Office, etc.).
- **Time-based Logic**: Handles working hours for specific services (e.g., Ticket Return).
- **Interactive Wizards**: Step-by-step data collection for "Lost Items".

## Prerequisites
- Node.js (v16 or higher)
- npm
- Docker (optional, for containerized deployment)

## Installation

1.  Navigate to the project directory:
    ```bash
    cd "АО КТЖ ПРОЕКТ"
    ```

2.  Install dependencies:
    ```bash
    npm install
    ```

3.  Configure environment:
    - Ensure `.env` file exists with valid `BOT_TOKEN` and `OPENAI_API_KEY`.

## Running the Bot

### Standard Mode
```bash
npm start
```

### Docker Mode
```bash
docker-compose up --build -d
```

## Structure
- `start.js`: Language selection.
- `main_menu.js`: Main navigation.
- `handlers/`: Specific logic for each flow.
- `utils/forwarder.js`: Advanced message forwarding engine.
- `config.js`: Configuration and Department Chat IDs.
