const alt = {
  en: {
    roundabout: 'Minimalist illustration of a car driving straight toward finished work while another is stuck in a roundabout of wrong turns.',
    vehicle: 'Flat vector illustration of a city car, work van, and off-roader.',
    steering: 'Abstract illustration of hands gripping a highly complex steering wheel covered in warning lights.',
  },
  el: {
    roundabout: 'Μινιμαλιστική απεικόνιση ενός αυτοκινήτου που κατευθύνεται ευθεία προς την ολοκληρωμένη εργασία, ενώ ένα άλλο έχει κολλήσει σε έναν κυκλικό κόμβο λανθασμένων διαδρομών.',
    vehicle: 'Επίπεδη διανυσματική απεικόνιση ενός αυτοκινήτου πόλης, ενός βαν εργασίας και ενός εκτός δρόμου οχήματος.',
    steering: 'Αφηρημένη απεικόνιση χεριών που κρατούν ένα ιδιαίτερα σύνθετο τιμόνι γεμάτο προειδοποιητικές λυχνίες.',
  },
};

function image(kind, description, eager = false) {
  return { type: 'html', value: `<img class="cars-illustration" src="/images/cars-vs-llms/${kind}-960.webp" srcset="/images/cars-vs-llms/${kind}-640.webp 640w, /images/cars-vs-llms/${kind}-960.webp 960w, /images/cars-vs-llms/${kind}-1440.webp 1440w" sizes="(max-width: 760px) calc(100vw - 40px), 720px" width="1440" height="810" alt="${description}" loading="${eager ? 'eager' : 'lazy'}" fetchpriority="${eager ? 'high' : 'auto'}" decoding="async" />` };
}

export default function articleVisuals() {
  return (tree, file) => {
    const frontmatter = file.data?.astro?.frontmatter ?? {};
    if (frontmatter.translationKey !== 'cars-vs-llms') return;
    const language = frontmatter.language === 'el' ? 'el' : 'en';
    const labels = alt[language];
    const output = [];
    let section = 0;
    let sectionFiveParagraphs = 0;
    let vehicleInserted = false;
    let steeringInserted = false;

    for (const node of tree.children) {
      if (node.type === 'heading' && node.depth === 1) output.push(image('roundabout', labels.roundabout, true));
      if (node.type === 'heading' && node.depth === 2) {
        const text = node.children?.map((child) => child.value ?? '').join('') ?? '';
        const nextSection = Number.parseInt(text.match(/^\s*(\d+)\./)?.[1] ?? '0', 10);
        if (section === 2 && !vehicleInserted) { output.push(image('vehicle-lineup', labels.vehicle)); vehicleInserted = true; }
        section = nextSection;
      }
      output.push(node);
      if (section === 5 && node.type === 'paragraph') {
        sectionFiveParagraphs += 1;
        if (sectionFiveParagraphs === 5 && !steeringInserted) { output.push(image('steering-wheel', labels.steering)); steeringInserted = true; }
      }
    }
    tree.children = output;
  };
}
