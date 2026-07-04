export interface CarEducationEntry {
  id: string;
  title: string;
  description: string;
  bullets?: string[];
}

export interface CarEducationSection {
  id: string;
  title: string;
  intro?: string;
  entries?: CarEducationEntry[];
  bullets?: string[];
  accordionItems?: { id: string; title: string; description: string }[];
  note?: string;
}

export interface CarEducationPanel {
  id: string;
  title: string;
  intro: string;
  sections: CarEducationSection[];
}

export const CAR_EDUCATION_PANELS: Record<string, CarEducationPanel> = {
  'new-vs-used': {
    id: 'new-vs-used',
    title: 'New vs. Used',
    intro: "Choosing between new, used, and certified pre-owned comes down to budget, risk tolerance, and how long you plan to keep the vehicle.",
    sections: [
      {
        id: 'conditions',
        title: 'Vehicle Conditions Explained',
        entries: [
          {
            id: 'new',
            title: 'New',
            description: 'Zero miles, full factory warranty, latest features. You pay a premium but have no unknowns.',
            bullets: [
              'Full manufacturer warranty (typically 3yr/36k bumper-to-bumper)',
              'Latest safety tech and connectivity features',
              'Eligible for manufacturer financing incentives',
              'Depreciates ~15–20% in the first year',
            ],
          },
          {
            id: 'used',
            title: 'Used / Pre-Owned',
            description: 'Lower purchase price and slower depreciation — but condition and history vary.',
            bullets: [
              'Significantly lower sticker price than new',
              'Run a vehicle history report (Carfax/AutoCheck)',
              'Ask for service records and have a mechanic inspect',
              'May still have remaining factory warranty coverage',
            ],
          },
          {
            id: 'cpo',
            title: 'Certified Pre-Owned (CPO)',
            description: "Manufacturer-inspected used vehicles with extended warranty coverage — the middle ground.",
            bullets: [
              'Multi-point factory inspection (typically 150+ points)',
              'Extended powertrain warranty (often 5yr/100k)',
              'Roadside assistance and rental coverage included',
              'Priced between new and private-party used',
            ],
          },
        ],
      },
      {
        id: 'condition-tip',
        title: 'Which Is Right for You?',
        bullets: [
          'If budget is tight: 2–4 year old used or CPO gives the best value',
          'If you keep cars 7+ years: new makes sense — you amortize the premium',
          'If you trade every 3 years: used or CPO is almost always smarter',
          'CPO is ideal when you want peace of mind without paying full new price',
        ],
      },
    ],
  },

  'body-type-guide': {
    id: 'body-type-guide',
    title: 'Body Type Guide',
    intro: "Different body styles suit different lifestyles. Here's how to match the shape of the car to how you'll actually use it.",
    sections: [
      {
        id: 'body-types',
        title: 'Body Styles',
        entries: [
          {
            id: 'suv',
            title: 'SUV / Crossover',
            description: 'The most versatile option — high seating position, available AWD, and room for people and cargo.',
            bullets: [
              'Compact (RAV4, CR-V): easy to park, great fuel economy',
              'Midsize (Explorer, Highlander): 7–8 seats, more towing',
              'Ideal for families, adventure, and all-weather driving',
            ],
          },
          {
            id: 'truck',
            title: 'Truck / Pickup',
            description: 'Best-in-class towing and payload. Perfect for work, recreation, and hauling.',
            bullets: [
              'Full-size (F-150, Silverado): max capability, comfortable cabins',
              'Mid-size (Ranger, Tacoma): easier to park, better fuel economy',
              'Look for tow package if you plan to pull a trailer',
            ],
          },
          {
            id: 'sedan',
            title: 'Sedan',
            description: 'Efficient, affordable, and easy to drive. Best for commuters and city dwellers.',
            bullets: [
              'Lower center of gravity = better handling',
              'Better fuel economy than SUVs of similar size',
              'Less cargo space but easier urban parking',
            ],
          },
          {
            id: 'hatchback',
            title: 'Hatchback',
            description: 'Sedan efficiency with more flexible cargo access. Rear seats fold flat.',
            bullets: [
              'Surprisingly spacious cargo area',
              'Lower and more fun to drive than an SUV',
              'Great for people who want practicality without height',
            ],
          },
          {
            id: 'wagon',
            title: 'Wagon',
            description: 'Car-like driving with a long cargo area and, often, available AWD.',
            bullets: [
              'More cargo length than a sedan or hatchback',
              'Lower roof and easier loading than most SUVs',
              'Great for road trips, dogs, skis, and outdoorsy daily driving',
            ],
          },
          {
            id: 'minivan',
            title: 'Minivan',
            description: 'Unmatched passenger and cargo space. The ultimate family hauler.',
            bullets: [
              'Sliding rear doors — easier for kids and car seats',
              'Fold-flat or Stow-n-Go seating for maximum cargo',
              'Lower step-in height than a truck or large SUV',
            ],
          },
          {
            id: 'van',
            title: 'Van',
            description: 'Best for commercial upfit, shuttle duty, delivery routes, and maximum enclosed cargo.',
            bullets: [
              'Cargo vans prioritize payload and shelving space',
              'Passenger vans add rows for teams, shuttles, and large groups',
              'Roof height and wheelbase matter more than horsepower for most work use',
            ],
          },
          {
            id: 'coupe',
            title: 'Coupe',
            description: 'Performance-focused, lower roofline, typically 2 doors. Built for driving enjoyment.',
            bullets: [
              'Sport suspension and engine tuning standard on most trims',
              'Limited rear passenger space — best as a 2-person car',
              'Usually stiffer and quieter than a convertible version',
            ],
          },
          {
            id: 'convertible',
            title: 'Convertible',
            description: 'Top-down driving for shoppers who value experience over maximum practicality.',
            bullets: [
              'Best as a fun commuter, weekend car, or second vehicle',
              'Soft tops save weight; hardtops add noise and weather protection',
              'Check trunk space with the roof stowed',
            ],
          },
        ],
      },
    ],
  },

  'financing-basics': {
    id: 'financing-basics',
    title: 'Financing Basics',
    intro: 'Understanding how car financing works helps you get a better deal and avoid common pitfalls.',
    sections: [
      {
        id: 'key-terms',
        title: 'Key Terms',
        entries: [
          {
            id: 'apr',
            title: 'APR (Annual Percentage Rate)',
            description: 'The annual cost of borrowing, including interest and fees. Lower is better. Manufacturer promotions often offer 0% APR on new vehicles for qualified buyers.',
          },
          {
            id: 'term',
            title: 'Loan Term',
            description: "How long you'll make payments — typically 36, 48, 60, or 72 months. Longer terms lower your monthly payment but increase total interest paid.",
          },
          {
            id: 'down',
            title: 'Down Payment',
            description: 'Cash paid upfront. 10–20% down reduces your monthly payment and interest cost. A larger down payment also prevents being "underwater" (owing more than the car is worth).',
          },
          {
            id: 'trade',
            title: 'Trade-In Value',
            description: "What the dealer offers for your current vehicle. Get a KBB or Carmax instant offer first so you know your vehicle's market value before negotiating.",
          },
        ],
      },
      {
        id: 'finance-tips',
        title: 'Smart Financing Tips',
        bullets: [
          'Get pre-approved from your bank or credit union before visiting',
          'Negotiate the vehicle price and trade-in value separately',
          "Compare the dealer's financing offer against your pre-approval",
          'Avoid extending the term just to lower the monthly payment',
          'Ask about manufacturer rebates — they stack with low APR sometimes',
        ],
        note: 'A lower monthly payment via a longer term costs more overall. Focus on total cost, not just the monthly number.',
      },
    ],
  },

  'ev-hybrid-guide': {
    id: 'ev-hybrid-guide',
    title: 'EV & Hybrid Guide',
    intro: "Electric and hybrid vehicles offer lower fuel costs and reduced emissions — but they're not one-size-fits-all. Here's how to choose.",
    sections: [
      {
        id: 'powertrain-types',
        title: 'Powertrain Types',
        entries: [
          {
            id: 'hybrid',
            title: 'Hybrid (HEV)',
            description: 'Gas engine + electric motor. Charges itself via regenerative braking. No plugging in required.',
            bullets: [
              'Best fuel economy improvement in city driving',
              'No range anxiety — fills up like a regular car',
              'Great for high-mileage commuters (RAV4 Hybrid, Accord Hybrid)',
            ],
          },
          {
            id: 'phev',
            title: 'Plug-In Hybrid (PHEV)',
            description: 'Gas + larger battery. Charges from an outlet for 20–50 miles of electric range, then runs as a hybrid.',
            bullets: [
              'Drive electric for daily commutes, gas for road trips',
              'RAV4 Prime gets 42 miles EV range + hybrid fallback',
              'May qualify for federal tax credit up to $7,500',
            ],
          },
          {
            id: 'ev',
            title: 'Battery Electric (BEV)',
            description: 'Pure electric — no gas engine. Charges from home outlet or public fast chargers.',
            bullets: [
              'Zero tailpipe emissions, lowest per-mile energy cost',
              'Plan around charging: home Level 2 charger recommended',
              'Range 200–400+ miles depending on model and conditions',
              'Federal EV tax credit up to $7,500 for qualifying vehicles',
            ],
          },
        ],
      },
      {
        id: 'ev-considerations',
        title: 'Is an EV Right for You?',
        bullets: [
          'Do you have a garage or reliable overnight charging access?',
          'Is your daily round-trip under 200 miles? (Most EVs handle this easily)',
          'Are there DC fast chargers near your frequent routes?',
          'If you take frequent long road trips, a PHEV may be a smarter choice',
        ],
        note: 'Most EV owners charge at home overnight and rarely need public charging for daily driving.',
      },
    ],
  },

  'glossary': {
    id: 'glossary',
    title: 'Glossary',
    intro: "Car buying has its own language. Here are the terms you'll encounter most.",
    sections: [
      {
        id: 'drivetrain',
        title: 'Drivetrain Terms',
        entries: [
          {
            id: 'awd',
            title: 'AWD (All-Wheel Drive)',
            description: 'Power sent to all four wheels automatically as needed. Great for rain, light snow, and off-road capability. Different from 4WD — AWD is always-on and computer-managed.',
          },
          {
            id: '4wd',
            title: '4WD (Four-Wheel Drive)',
            description: 'Driver-selectable system for serious off-road or heavy snow. Typically found on trucks and body-on-frame SUVs like the 4Runner and F-150.',
          },
          {
            id: 'fwd',
            title: 'FWD (Front-Wheel Drive)',
            description: 'Engine drives the front wheels. Most fuel-efficient layout. Standard on most sedans and compact SUVs.',
          },
        ],
      },
      {
        id: 'pricing',
        title: 'Pricing & Value Terms',
        entries: [
          {
            id: 'msrp',
            title: 'MSRP',
            description: "Manufacturer's Suggested Retail Price — the sticker price. Actual transaction price is often negotiable, especially on used vehicles.",
          },
          {
            id: 'invoice',
            title: 'Invoice Price',
            description: 'What the dealer paid for the car from the manufacturer. Negotiating near invoice on new vehicles is a good benchmark.',
          },
          {
            id: 'trim',
            title: 'Trim Level',
            description: 'The feature package within a model (e.g., Base, Sport, EX-L, Limited). Higher trims add features but raise the price.',
          },
        ],
      },
      {
        id: 'safety',
        title: 'Safety Ratings',
        entries: [
          {
            id: 'nhtsa',
            title: 'NHTSA Stars',
            description: 'National Highway Traffic Safety Administration crash tests — 5-star is the highest. Tests frontal, side, and rollover crash performance.',
          },
          {
            id: 'iihs',
            title: 'IIHS Top Safety Pick',
            description: 'Insurance Institute ratings (Good/Acceptable/Marginal/Poor). "Top Safety Pick+" is the gold standard — look for it when safety is a priority.',
          },
        ],
      },
    ],
  },
};
