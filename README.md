# SquadTime Gaming Planner

## Overview
SquadTime is a gaming planner application designed to help users organize their gaming sessions, manage game information, and connect with friends. This project is built using TypeScript and styled with Tailwind CSS.

## Features
- Input parameters for gaming sessions
- Display filtered games based on user input
- Individual game information presented in a card format
- Responsive design using Tailwind CSS

## Project Structure
```
squadtime-gaming-planner
├── src
│   ├── app.ts                # Entry point of the application
│   ├── components            # React components
│   │   ├── Header.ts         # Navigation and title component
│   │   ├── GamePlanner.ts    # Component for planning games
│   │   └── EventCard.ts      # Component for displaying game info
│   ├── styles                # Stylesheets
│   │   └── globals.css       # Global styles and Tailwind CSS imports
│   ├── types                 # Type definitions
│   │   ├── game.ts           # Game data structure
│   │   ├── event.ts          # Session parameters structure
│   │   └── player.ts         # User profile structure
│   ├── utils                 # Utility functions
│   │   └── helpers.ts        # Data manipulation and API helpers
│   └── db                    # Database schema
│       └── schema.ts         # Database structure definitions
├── public
│   └── index.html            # Main HTML file
├── package.json              # NPM configuration
├── tsconfig.json             # TypeScript configuration
├── tailwind.config.js        # Tailwind CSS configuration
├── postcss.config.js         # PostCSS configuration
└── README.md                 # Project documentation
```

## Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd squadtime-gaming-planner
   ```
3. Install dependencies:
   ```
   npm install
   ```

## Usage
To start the development server, run:
```
npm run dev
```

Open your browser and navigate to `http://localhost:3000` to view the application.


## License
This project is licensed under the MIT License. See the LICENSE file for details.