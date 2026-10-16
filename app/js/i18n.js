// English / French. The interface is written in English; when French is on,
// translate() rewrites visible text (and placeholder / aria-label / title) as it
// is rendered, including text that changes later (toasts, GPS status, map panels).
// User data is never in the dictionary, and inputs' values are never touched.

const FR = {
  // navigation and common
  'Stations': 'Stations', 'Cameras': 'Caméras', 'Deploy': 'Déployer', 'Map': 'Carte', 'Settings': 'Paramètres',
  'Back': 'Retour', 'Projects': 'Projets', 'Save': 'Enregistrer', 'Cancel': 'Annuler', 'Delete': 'Supprimer',
  'Continue': 'Continuer', 'Replace': 'Remplacer', 'Edit': 'Modifier', 'Close': 'Fermer', 'Details': 'Détails',
  'Yes': 'Oui', 'No': 'Non', 'Select': 'Choisir', 'optional': 'facultatif', 'Name': 'Nom', 'Description': 'Description',
  'Notes': 'Notes', 'Status': 'Statut', 'Action': 'Action', 'Camera': 'Caméra', 'Station': 'Station',
  'Check': 'Contrôler', 'Go to': 'Y aller', 'Export': 'Exporter', 'Share': 'Partager', 'Download': 'Télécharger',
  'Undo': 'Annuler', 'Clear': 'Effacer', 'Saved': 'Enregistré',

  // home and new project
  'New project': 'Nouveau projet', 'Restore backup': 'Restaurer une sauvegarde',
  'No backup found in this zip': 'Aucune sauvegarde dans ce zip',
  'Project name': 'Nom du projet', 'e.g. Parc W dry season 2026': 'ex. Parc W saison sèche 2026',
  'Environmental variables': 'Variables environnementales', 'Create project': 'Créer le projet',
  'Give the project a name': 'Donnez un nom au projet',
  'Project created, now add your cameras': 'Projet créé, ajoutez maintenant vos caméras',
  'Integer': 'Entier', 'Float': 'Décimal', 'Text': 'Texte',
  'Choices, comma separated (optional)': 'Choix séparés par des virgules (facultatif)',
  'Add variable': 'Ajouter une variable', 'Remove variable': 'Supprimer la variable',
  'Variable name': 'Nom de la variable', 'Data type': 'Type de données', 'Choices': 'Choix',
  'A variable has options but no name': 'Une variable a des choix mais pas de nom',

  // stations dashboard
  'Active': 'Active', 'Cameras free': 'Caméras libres', 'Trap-days': 'Jours-pièges', 'Checks due': 'Contrôles dus',
  'Active stations': 'Stations actives', 'On track': 'À jour', 'Check due': 'Contrôle dû', 'Overdue': 'En retard',
  'No camera deployed yet': 'Aucune caméra déployée', 'Deploy a camera': 'Déployer une caméra',
  'Removed': 'Retirée', 'Removed (damaged)': 'Retirée (endommagée)', 'Removed (inactive)': 'Retirée (inactive)',
  'Stolen': 'Volée', 'Ended': 'Terminé', 'Lost': 'Perdue',

  // deployment detail
  'Deployment': 'Déploiement', 'Start': 'Début', 'End': 'Fin', 'Coordinates': 'Coordonnées',
  'GPS accuracy': 'Précision GPS', 'Elevation': 'Altitude', 'Set up by': 'Installé par',
  'Camera setup': 'Installation de la caméra', 'Height': 'Hauteur', 'Tilt': 'Inclinaison', 'Heading': 'Orientation',
  'Detection distance': 'Distance de détection', 'Field of view': 'Champ de vision', 'Trigger delay': 'Délai de déclenchement',
  'Depth': 'Profondeur', 'Bait': 'Appât', 'Camera clock': 'Horloge de la caméra', 'Checked, correct': 'Vérifiée',
  'Has issues': 'Problème', 'Not checked': 'Non vérifiée', 'Checked': 'Vérifiée', 'Environment': 'Environnement',
  'Habitat': 'Habitat', 'Feature': 'Élément ciblé', 'Groups': 'Groupes', 'Comments': 'Commentaires',
  'SD swapped': 'Carte SD changée', 'Delete this check': 'Supprimer ce contrôle',
  'Delete this check (reopens deployment)': 'Supprimer ce contrôle (rouvre le déploiement)',
  'No check yet': 'Aucun contrôle', 'Delete deployment': 'Supprimer le déploiement',
  'Check deleted': 'Contrôle supprimé', 'Deployment deleted': 'Déploiement supprimé',

  // statuses and actions
  'Inactive': 'Inactive', 'Damaged': 'Endommagée', 'Leave': 'Laisser', 'Remove': 'Retirer', 'None': 'Aucune',
  'Available': 'Disponible', 'Deployed': 'Déployée', 'Maintenance': 'Maintenance', 'All': 'Toutes',

  // cameras
  'No camera registered yet': 'Aucune caméra enregistrée', 'Add cameras': 'Ajouter des caméras', 'No model': 'Sans modèle',
  'Camera ID': 'ID caméra', 'Make': 'Marque', 'Model': 'Modèle', 'Serial number': 'Numéro de série',
  'e.g. CT07': 'ex. CT07', 'e.g. Mare Bali': 'ex. Mare Bali', 'Language': 'Langue', 'e.g. Browning': 'ex. Browning', 'e.g. BTC-8E': 'ex. BTC-8E',
  'Mark as lost': 'Marquer perdue', 'Send to maintenance': 'Envoyer en maintenance', 'Back in service': 'Remettre en service',
  'Make available': 'Rendre disponible', 'New camera': 'Nouvelle caméra', 'Add camera': 'Ajouter la caméra',
  'Add and enter another': 'Ajouter et continuer', 'Deployment history': 'Historique des déploiements',
  'Delete camera': 'Supprimer la caméra', 'Status updated': 'Statut mis à jour', 'Camera deleted': 'Caméra supprimée',
  'Prefix': 'Préfixe', 'Number': 'Nombre', 'Digits': 'Chiffres', 'Create cameras': 'Créer les caméras',
  'Number must be 1 to 200': 'Le nombre doit être entre 1 et 200',

  // deploy form
  'All cameras are deployed, in maintenance or lost': 'Toutes les caméras sont déployées, en maintenance ou perdues',
  'Register your cameras first': "Enregistrez d'abord vos caméras", 'See cameras': 'Voir les caméras',
  'New deployment': 'Nouveau déploiement', 'Position': 'Position',
  'Re-take GPS position': 'Reprendre la position GPS', 'Get GPS position': 'Obtenir la position GPS',
  'Waiting for satellites': 'Recherche des satellites', 'Latitude': 'Latitude', 'Longitude': 'Longitude',
  'Accuracy (m)': 'Précision (m)', 'Elevation (m)': 'Altitude (m)', 'Station and camera': 'Station et caméra',
  'Station name': 'Nom de la station', 'New station': 'Nouvelle station', 'Station ID': 'ID station',
  'Choose an available camera': 'Choisir une caméra disponible', 'Start date & time': 'Date et heure de début',
  'End date & time': 'Date et heure de fin', 'Copy last setup': 'Copier la dernière installation',
  'Height (m)': 'Hauteur (m)', 'Tilt (°)': 'Inclinaison (°)', '0 = horizontal': '0 = horizontale',
  'Heading (°)': 'Orientation (°)', 'direction the lens faces': "direction de l'objectif", 'Compass': 'Boussole',
  'Lock': 'Fixer', 'Detection range (m)': 'Portée de détection (m)', 'Field of view (°)': 'Champ de vision (°)',
  'Camera date/time': 'Date et heure de la caméra', 'Bait or lure used': 'Appât ou leurre utilisé',
  'More settings': 'Plus de réglages', 'Trigger delay (s)': 'Délai de déclenchement (s)', 'Depth (m)': 'Profondeur (m)',
  'No environmental variable yet,': 'Aucune variable environnementale,', 'add them in settings': 'ajoutez-les dans les paramètres',
  'Save changes': 'Enregistrer les modifications', 'Finish deployment': 'Terminer le déploiement', 'Use it': "L'utiliser",
  'GPS not available, enter coordinates manually': 'GPS indisponible, saisissez les coordonnées',
  'Whole number expected': 'Nombre entier attendu', 'Number expected': 'Nombre attendu',
  'Choose a station': 'Choisissez une station', 'Fix the highlighted fields': 'Corrigez les champs signalés',
  'Save anyway?': 'Enregistrer quand même ?', 'Deployment updated': 'Déploiement mis à jour',

  // validation
  'Latitude must be between -90 and 90': 'La latitude doit être entre -90 et 90',
  'Longitude must be between -180 and 180': 'La longitude doit être entre -180 et 180',
  'Choose a camera': 'Choisissez une caméra', 'Station ID is required': "L'ID de la station est requis",
  'Start date/time is required': 'La date de début est requise', 'Must be ≥ 1 m': 'Doit être ≥ 1 m',
  'Height must be 0 to 100 m': 'La hauteur doit être entre 0 et 100 m', 'Depth must be ≥ 0 m': 'La profondeur doit être ≥ 0 m',
  'Tilt must be between -90 and 90°': "L'inclinaison doit être entre -90 et 90°",
  'Heading must be between 0 and 360°': "L'orientation doit être entre 0 et 360°",
  'Detection distance must be ≥ 0 m': 'La distance de détection doit être ≥ 0 m', 'Delay must be ≥ 0 s': 'Le délai doit être ≥ 0 s',
  'Field of view must be 1 to 360°': 'Le champ de vision doit être entre 1 et 360°',
  'Camera height is recommended': 'La hauteur de la caméra est recommandée',
  'Start cannot be in the future': 'Le début ne peut pas être dans le futur',
  'End cannot be in the future': 'La fin ne peut pas être dans le futur', 'End is before start': 'La fin est avant le début',
  'Camera ID is required': "L'ID de la caméra est requis",

  // check form
  'This deployment is closed': 'Ce déploiement est clôturé', 'Camera status': 'État de la caméra', 'Date & time': 'Date et heure',
  'Battery (%)': 'Batterie (%)', 'Images on card': 'Images sur la carte', 'SD card swapped / downloaded': 'Carte SD changée / vidée',
  'Observer': 'Observateur', 'e.g. lens fogged, moved by elephant': 'ex. objectif embué, déplacée par un éléphant',
  'Save check': 'Enregistrer le contrôle', 'is marked lost': 'est marquée perdue',
  'Deployment closes now,': 'Le déploiement se termine maintenant,', 'goes to maintenance': 'passe en maintenance',
  'goes to available cameras': 'redevient disponible', 'Camera stays in place': 'La caméra reste en place',
  'Set the check date and time': "Indiquez la date et l'heure du contrôle",
  'The check cannot be in the future': 'Le contrôle ne peut pas être dans le futur',
  'The check cannot be before the deployment': 'Le contrôle ne peut pas précéder le déploiement',
  'Battery must be 0 to 100%': 'La batterie doit être entre 0 et 100 %', 'This closes the deployment': 'Cela clôture le déploiement',
  'Camera marked lost': 'Caméra marquée perdue', 'Camera removed': 'Caméra retirée', 'Check saved': 'Contrôle enregistré',

  // map
  'Center on my position': 'Centrer sur ma position', 'Measure distance': 'Mesurer une distance', 'Offline map': 'Carte hors ligne',
  'No GPS': 'Pas de GPS', 'GPS': 'GPS', 'Waiting for GPS': 'En attente du GPS', 'Use compass': 'Utiliser la boussole',
  'Compass on': 'Boussole active', 'Stop navigation': 'Arrêter la navigation', 'No GPS position yet': 'Pas encore de position GPS',
  'Add my position': 'Ajouter ma position', 'From zoom': 'Zoom de', 'To zoom': 'Zoom à', 'Delete stored tiles': 'Supprimer les tuiles',
  'Stored tiles deleted': 'Tuiles supprimées', 'You are offline, connect to download': 'Hors ligne, connectez-vous pour télécharger',
  'OpenTopoMap (terrain)': 'OpenTopoMap (relief)', 'Custom tile URL': 'URL de tuiles personnalisée', 'Download cancelled': 'Téléchargement annulé',
  'No tile URL configured': 'Aucune URL de tuiles configurée',

  // settings
  'Only closed deployments': 'Seulement les déploiements clôturés', 'All deployments complete': 'Tous les déploiements sont complets',
  'Project settings': 'Paramètres du projet', 'Default observer': 'Observateur par défaut', 'GPS target (m)': 'Cible GPS (m)',
  'GPS averaging (s)': 'Moyenne GPS (s)', 'Check every (days)': 'Contrôle tous les (jours)', 'Base map': 'Fond de carte',
  'Tile URL template': "Modèle d'URL des tuiles", 'Save settings': 'Enregistrer les paramètres', 'Storage': 'Stockage',
  'Storage estimate not available': 'Estimation du stockage indisponible',
  'Install the app (Add to Home screen) to protect your data': "Installez l'application (écran d'accueil) pour protéger vos données",
  'Delete this project': 'Supprimer ce projet', 'Sharing is not available here, use Export': 'Partage indisponible ici, utilisez Exporter',
  'Custom URL must contain {z}, {x} and {y}': "L'URL doit contenir {z}, {x} et {y}", 'Settings saved': 'Paramètres enregistrés',
  'All cameras, deployments and checks are removed from this phone. Type the project name to confirm':
    'Toutes les caméras, déploiements et contrôles seront supprimés de ce téléphone. Tapez le nom du projet pour confirmer',
  'Project deleted': 'Projet supprimé',

  // app, sensors, storage and file errors
  'Back online': 'De retour en ligne', 'Offline, everything keeps working': 'Hors ligne, tout continue de fonctionner',
  'Something went wrong': "Une erreur s'est produite", 'Back to projects': 'Retour aux projets',
  'Storage unavailable': 'Stockage indisponible', 'Private browsing may block offline storage': 'La navigation privée peut bloquer le stockage',
  'GPS not available on this device': 'GPS indisponible sur cet appareil',
  'Location permission denied, allow it in your phone settings': 'Localisation refusée, autorisez-la dans les réglages du téléphone',
  'Position unavailable, move to an open area': 'Position indisponible, allez dans un endroit dégagé',
  'GPS timed out, try again in an open area': 'GPS trop long, réessayez dans un endroit dégagé',
  'No GPS fix, move to an open area or enter coordinates manually': 'Pas de signal GPS, allez dans un endroit dégagé ou saisissez les coordonnées',
  'No compass on this device': 'Pas de boussole sur cet appareil',
  'Compass blocked, close the app fully, reopen it and tap Allow': "Boussole bloquée, fermez complètement l'application, rouvrez-la et touchez Autoriser",
  'Compass blocked, allow motion sensors for this site in the browser settings': 'Boussole bloquée, autorisez les capteurs de mouvement pour ce site dans les réglages du navigateur',
  'Camera not found': 'Caméra introuvable', 'This camera has deployments and cannot be deleted': 'Cette caméra a des déploiements et ne peut pas être supprimée',
  'This camera already has deployments; its ID can no longer change': "Cette caméra a déjà des déploiements, son ID ne peut plus changer",
  'Check time is before the deployment start': 'Le contrôle est avant le début du déploiement',
  'Close the deployment with a check first': "Clôturez d'abord le déploiement par un contrôle",
  'Use Deploy to deploy a camera': 'Utilisez Déployer pour déployer une caméra',
  'This deployment is already closed': 'Ce déploiement est déjà clôturé',
  'Not a valid JSON file': 'Fichier JSON invalide', 'Not a Trapline backup file': "Ce n'est pas une sauvegarde Trapline",
  'Backup was made by a newer version of Trapline': 'Sauvegarde faite avec une version plus récente de Trapline',
  'Backup is missing the project': 'Le projet manque dans la sauvegarde', 'Not a zip file': "Ce n'est pas un fichier zip",
  'Corrupt zip file': 'Fichier zip endommagé', 'never': 'jamais',
  // feature types (older deployments)
  'Paved road': 'Route goudronnée', 'Dirt road': 'Piste', 'Hiking trail': 'Sentier', 'Game trail': 'Sentier de faune',
  'Road underpass': 'Passage sous route', 'Road overpass': 'Passage sur route', 'Road bridge': 'Pont',
  'Culvert': 'Buse', 'Burrow': 'Terrier', 'Nest site': 'Site de nid', 'Carcass': 'Carcasse',
  'Water source': "Point d'eau", 'Fruiting tree': 'Arbre fruitier',
};

// Text with values inside: [pattern, French replacement]
const CARD = { N: 'N', S: 'S', E: 'E', W: 'O' };
const PATTERNS = [
  [/^Closed deployments \((\d+)\)$/, 'Déploiements clôturés ($1)'],
  [/^Checks \((\d+)\)$/, 'Contrôles ($1)'],
  [/^(\d+) trap-days$/, '$1 jours-pièges'],
  [/^Visited today$/, "Visitée aujourd'hui"],
  [/^Visited yesterday$/, 'Visitée hier'],
  [/^Visited (\d+) days ago$/, 'Visitée il y a $1 jours'],
  [/^(\d{1,2} \S+ \d{4}) to (\d{1,2} \S+ \d{4})$/, 'du $1 au $2'],
  [/^(\d{1,2} \S+ \d{4}) to now$/, "du $1 à aujourd'hui"],
  [/^([A-Za-z0-9._-]*\d) to ([A-Za-z0-9._-]*\d)$/, '$1 à $2'],
  [/^Battery (\d+)%$/, 'Batterie $1 %'],
  [/^(\d+) images$/, '$1 images'],
  [/^Delete the check of (.+)\?$/, 'Supprimer le contrôle du $1 ?'],
  [/^Delete this deployment at (.+)\?$/, 'Supprimer ce déploiement à $1 ?'],
  [/^Its (\d+) check\(s\) are deleted too\. This cannot be undone$/, 'Ses $1 contrôle(s) seront aussi supprimés, action irréversible'],
  [/^Replace (.+) with the backup of (.+)\?$/, 'Remplacer $1 par la sauvegarde du $2 ?'],
  [/^Camera (.+) added$/, 'Caméra $1 ajoutée'],
  [/^(\d+) cameras added$/, '$1 caméras ajoutées'],
  [/^Delete camera (.+)\?$/, 'Supprimer la caméra $1 ?'],
  [/^Edit ([A-Za-z0-9._-]+)$/, 'Modifier $1'],
  [/^Check ([A-Za-z0-9._-]+)$/, 'Contrôle $1'],
  [/^To ([A-Za-z0-9._-]+)$/, 'Vers $1'],
  [/^Existing station \((\d+)\)$/, 'Station existante ($1)'],
  [/^Waiting for satellites (\d+) s$/, 'Recherche des satellites $1 s'],
  [/^(\d+) fixes, accuracy ±(\d+) m$/, '$1 points, précision ±$2 m'],
  [/^You are (.+) from free station$/, 'Vous êtes à $1 de la station libre'],
  [/^(.+) deployed at (.+)$/, '$1 déployée à $2'],
  [/^Setup copied from (.+)$/, 'Installation copiée depuis $1'],
  [/^Deployed (.+)$/, 'Déployée le $1'],
  [/^Last check (.+)$/, 'Dernier contrôle le $1'],
  [/^Deployment closes at the last confirmed working date \((.+)\),$/, 'Le déploiement se termine à la dernière date de fonctionnement confirmée ($1),'],
  [/^GPS accuracy (\d+) m is worse than the (\d+) m target$/, 'Précision GPS de $1 m, moins bonne que la cible de $2 m'],
  [/^(\d+)° ([NSEW]{1,3})(, you are there)?$/, (m) => `${m[1]}° ${m[2].replace(/[NSEW]/g, (c) => CARD[c])}${m[3] ? ', vous y êtes' : ''}`],
  [/^Checked (.+)$/, 'Contrôlée le $1'],
  [/^(.+) away$/, 'à $1'],
  [/^(\d+) tiles offline$/, '$1 tuiles hors ligne'],
  [/^Delete all stored (.+) tiles\?$/, 'Supprimer toutes les tuiles $1 ?'],
  [/^([\d,.  ]+) tiles, about (\d+) MB$/, '$1 tuiles, environ $2 Mo'],
  [/^, too many \(max (.+)\)$/, ', trop (max $1)'],
  [/^too many \(max (.+)\)$/, 'trop (max $1)'],
  [/^(\d+) of (\d+) tiles$/, '$1 sur $2 tuiles'],
  [/^(\d+) of (\d+) tiles, (\d+) failed$/, '$1 sur $2 tuiles, $3 en échec'],
  [/^Offline map ready \((\d+) tiles\)$/, 'Carte hors ligne prête ($1 tuiles)'],
  [/^(\d+) tiles available offline$/, '$1 tuiles disponibles hors ligne'],
  [/^(\d+) tiles available offline, (\d+) failed, retry to fill gaps$/, '$1 tuiles disponibles hors ligne, $2 en échec, relancez pour compléter'],
  [/^Last backup: (.+)$/, (m) => `Dernière sauvegarde : ${m[1] === 'never' ? 'jamais' : m[1]}`],
  [/^(\d+) item\(s\) to complete$/, '$1 élément(s) à compléter'],
  [/^(.+) still active$/, '$1 encore actif'],
  [/^(.+) has no GPS accuracy$/, '$1 sans précision GPS'],
  [/^(.+) has no camera model$/, '$1 sans modèle de caméra'],
  [/^([\d.]+) MB used of (\d+) MB$/, '$1 Mo utilisés sur $2 Mo'],
  [/^(.+) saved to Downloads$/, '$1 enregistré dans Téléchargements'],
  [/^Camera (.+) is not available \((.+)\)$/, 'La caméra $1 n\'est pas disponible ($2)'],
  [/^Camera (.+) is deployed elsewhere; cannot reopen$/, 'La caméra $1 est déployée ailleurs, impossible de rouvrir'],
  [/^Station (.+) already exists, pick it from the list$/, 'La station $1 existe déjà, choisissez-la dans la liste'],
  [/^Station (.+) already has an active camera$/, 'La station $1 a déjà une caméra active'],
  [/^Device ID "(.+)" already exists in this project$/, "L'ID « $1 » existe déjà dans ce projet"],
  [/^Variable "(.+)" is listed twice$/, 'La variable « $1 » est en double'],
  [/^Backup is missing "(.+)"$/, 'La sauvegarde ne contient pas « $1 »'],
  [/^(.+) does not allow bulk downloads, choose another base map in settings$/, '$1 ne permet pas le téléchargement de zones, choisissez un autre fond de carte'],
  [/^Area too large \((\d+) tiles, max (\d+)\), zoom in or lower the max zoom$/, 'Zone trop grande ($1 tuiles, max $2), zoomez ou baissez le zoom maximal'],
  [/^(.+) restored$/, '$1 restauré'],
  [/^Delete (.+)\?$/, 'Supprimer $1 ?'],
];

const read = () => { try { return localStorage.getItem('lang'); } catch { return null; } };
let lang = read() || (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : 'en');

export const getLang = () => lang;
export function setLang(l) {
  lang = l === 'fr' ? 'fr' : 'en';
  try { localStorage.setItem('lang', lang); } catch { /* private mode: session only */ }
  if (typeof document !== 'undefined') document.documentElement.lang = lang;
}

/** Translate one English UI string (exact, then patterns). */
export function tr(text) {
  if (lang !== 'fr' || !text) return text;
  if (Object.hasOwn(FR, text)) return FR[text];
  for (const [re, out] of PATTERNS) {
    const m = re.exec(text);
    if (m) return typeof out === 'function' ? out(m) : text.replace(re, out);
  }
  return text;
}

const ATTRS = ['placeholder', 'aria-label', 'title'];
const SKIP = 'script,style,.leaflet-tile-pane,.leaflet-control-attribution,[data-no-i18n]';

function translateNode(node) {
  if (node.nodeType === Node.TEXT_NODE) {
    const v = node.nodeValue;
    const core = v.trim();
    // a textarea's text is the user's own; its placeholder is still translated
    if (!core || node.parentElement?.closest(SKIP) || node.parentElement?.tagName === 'TEXTAREA') return;
    const out = tr(core);
    if (out !== core) node.nodeValue = v.replace(core, out);
    return;
  }
  if (node.nodeType !== Node.ELEMENT_NODE || node.closest(SKIP)) return;
  for (const a of ATTRS) {
    const v = node.getAttribute(a);
    if (v) { const out = tr(v); if (out !== v) node.setAttribute(a, out); }
  }
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (n.nodeType === Node.ELEMENT_NODE) {
      if (n.matches(SKIP)) continue;
      for (const a of ATTRS) {
        const v = n.getAttribute(a);
        if (v) { const out = tr(v); if (out !== v) n.setAttribute(a, out); }
      }
    } else translateNode(n);
  }
}

/** Keep the whole page translated, including content added or changed later. */
export function startTranslating(root = document.body) {
  document.documentElement.lang = lang;
  translateNode(root);
  new MutationObserver((records) => {
    if (lang !== 'fr') return;
    for (const r of records) {
      if (r.type === 'characterData') translateNode(r.target);
      else if (r.type === 'attributes') translateNode(r.target);
      else r.addedNodes.forEach(translateNode);
    }
  }).observe(root, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
}

/** Locale for dates and numbers. */
export const locale = () => (lang === 'fr' ? 'fr-FR' : 'en-GB');

export const FLATPICKR_FR = {
  firstDayOfWeek: 1,
  weekdays: {
    shorthand: ['dim', 'lun', 'mar', 'mer', 'jeu', 'ven', 'sam'],
    longhand: ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'],
  },
  months: {
    shorthand: ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'],
    longhand: ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'],
  },
  time_24hr: true,
};
