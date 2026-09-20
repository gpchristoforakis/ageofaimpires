import type { Language } from './config';

const ui = {
  en: {
    skip: 'Skip to main content', menu: 'Menu', close: 'Close', primaryNav: 'Primary navigation',
    nav: { articles: 'Articles', frameworks: 'Frameworks', notebook: 'Notebook', about: 'About' },
    languageSwitcher: 'Language', unavailable: 'Translation unavailable',
    share: 'Share', copied: 'Copied!', copyLink: 'Copy link:',
    footer: 'Clear thinking about AI, work, and the price of a useful result.',
    articles: 'Articles', continueReading: 'Continue reading', next: 'Next / Go deeper',
    readArticle: 'Read the article', readFollowup: 'Read the follow-up', allArticles: 'All articles',
    greekPendingTitle: 'Greek edition',
    greekPending: 'Greek editorial copy has not been supplied yet. English remains available while the translated edition is prepared.',
    noTranslatedArticles: 'No Greek articles are available yet.',
    tableScroll: 'Scroll sideways to read every column',
    tableAria: { vehicles: 'Vehicle types and AI counterparts', specifications: 'Car specifications and AI assistant qualities', journey: 'Questions to ask when choosing a car or AI' },
    calculator: { label: 'Interactive tool', title: 'The Effective Task Cost Calculator', description: 'Calculate the economic cost of an AI journey, separating completion cost from optional expansion.', hourlyRate: 'Your hourly rate (€ / hr)', modelCost: 'Model invocations (€)', correction: 'Steering and correction (minutes)', exploration: 'Optional exploration (minutes)', taskTotal: 'Effective task cost', expansionTotal: 'Scope expansion cost' },
    diagram: { aria: 'A diagram showing the main route to completion, corrective detours before the boundary, and optional branches after it.', start: 'Start', boundary: 'Boundary', completionBoundary: 'Completion boundary', done: 'Done', before: 'Before the line: corrections are part of finishing.', after: 'After the line: extensions are new work.' },
  },
  el: {
    skip: 'Μετάβαση στο κύριο περιεχόμενο', menu: 'Μενού', close: 'Κλείσιμο', primaryNav: 'Κύρια πλοήγηση',
    nav: { articles: 'Άρθρα', frameworks: 'Πλαίσια', notebook: 'Σημειώσεις', about: 'Σχετικά' },
    languageSwitcher: 'Γλώσσα', unavailable: 'Η μετάφραση δεν είναι διαθέσιμη',
    share: 'Κοινοποίηση', copied: 'Αντιγράφηκε!', copyLink: 'Αντιγραφή συνδέσμου:',
    footer: 'Καθαρή σκέψη για την τεχνητή νοημοσύνη, την εργασία και το κόστος ενός χρήσιμου αποτελέσματος.',
    articles: 'Άρθρα', continueReading: 'Συνέχεια ανάγνωσης', next: 'Επόμενο / Σε μεγαλύτερο βάθος',
    readArticle: 'Διαβάστε το άρθρο', readFollowup: 'Διαβάστε τη συνέχεια', allArticles: 'Όλα τα άρθρα',
    greekPendingTitle: 'Ελληνική έκδοση',
    greekPending: 'Το ελληνικό εκδοτικό κείμενο δεν έχει δοθεί ακόμη. Η αγγλική έκδοση παραμένει διαθέσιμη όσο ετοιμάζεται η μετάφραση.',
    noTranslatedArticles: 'Δεν υπάρχουν ακόμη διαθέσιμα άρθρα στα ελληνικά.',
    tableScroll: 'Σύρετε οριζόντια για να διαβάσετε όλες τις στήλες',
    tableAria: { vehicles: 'Τύποι οχημάτων και αντίστοιχες χρήσεις τεχνητής νοημοσύνης', specifications: 'Χαρακτηριστικά αυτοκινήτου και ιδιότητες βοηθού τεχνητής νοημοσύνης', journey: 'Ερωτήσεις για την επιλογή αυτοκινήτου ή τεχνητής νοημοσύνης' },
    calculator: { label: 'Διαδραστικό εργαλείο', title: 'Υπολογιστής πραγματικού κόστους εργασίας', description: 'Υπολογίστε το οικονομικό κόστος μιας διαδρομής με τεχνητή νοημοσύνη, χωρίζοντας την ολοκλήρωση από την προαιρετική επέκταση.', hourlyRate: 'Ωριαία αμοιβή (€ / ώρα)', modelCost: 'Κλήσεις μοντέλου (€)', correction: 'Καθοδήγηση και διορθώσεις (λεπτά)', exploration: 'Προαιρετική διερεύνηση (λεπτά)', taskTotal: 'Πραγματικό κόστος εργασίας', expansionTotal: 'Κόστος επέκτασης εύρους' },
    diagram: { aria: 'Διάγραμμα της κύριας διαδρομής προς την ολοκλήρωση, των διορθωτικών παρακάμψεων πριν από το όριο και των προαιρετικών κλάδων μετά από αυτό.', start: 'Αρχή', boundary: 'Όριο', completionBoundary: 'Όριο ολοκλήρωσης', done: 'Τέλος', before: 'Πριν από τη γραμμή: οι διορθώσεις ανήκουν στην ολοκλήρωση.', after: 'Μετά τη γραμμή: οι επεκτάσεις είναι νέα εργασία.' },
  },
} as const;

export function getUi(language: Language) { return ui[language]; }
