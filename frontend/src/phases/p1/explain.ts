import type { Character, PatternCode } from "./types";
import type { Mode } from "../../lib/richtext";

/** Explication pédagogique de chaque piège, en langage simple puis technique. */
export function explainPattern(code: PatternCode, character: Character, mode: Mode): string {
  const annee = new Date().getFullYear();
  const [y, m, d] = character.naissance.split("-");
  const naissance = `${d}/${m}/${y}`;
  const T: Record<PatternCode, [string, string]> = {
    prenom: [
      `Ton mot de passe contient le prénom du personnage (${character.prenom}) → un pirate qui a vu son profil l'essaie en premier.`,
      `Correspondance OSINT directe (prénom « ${character.prenom} ») : entropie quasi nulle.`],
    nom: [
      `Ton mot de passe contient son nom de famille (${character.nom}) → tout aussi facile à deviner.`,
      `Correspondance sur le nom de famille (« ${character.nom} »), public sur la plupart des profils.`],
    date_naissance: [
      `Ton mot de passe contient sa date de naissance (${naissance}) → un pirate teste toutes les formes d'une date en quelques secondes.`,
      `Date de naissance connue : un attaquant teste les ~15 formats usuels (JJMMAAAA, JJMM, AA…) quasi instantanément.`],
    ville: [
      `Ton mot de passe contient sa ville (${character.ville}) → une info souvent publique sur un profil.`,
      `Ville de résidence (« ${character.ville} ») : donnée publique fréquente, intégrée aux dictionnaires ciblés.`],
    animal: [
      `Ton mot de passe contient le nom de son animal (${character.animal}) → classique, et souvent affiché fièrement sur les réseaux !`,
      `Nom de l'animal de compagnie (« ${character.animal} ») : un des premiers mots testés par un dictionnaire personnalisé.`],
    club: [
      `Ton mot de passe contient son club de cœur (${character.club}) → visible sur n'importe quel profil de supporter.`,
      `Club favori (« ${character.club} ») : trivialement déductible d'un profil public.`],
    copain: [
      `Ton mot de passe contient le prénom de son copain/sa copine (${character.copain}) → ça se voit vite sur les réseaux sociaux.`,
      `Prénom du/de la partenaire (« ${character.copain} ») : donnée relationnelle publique, exploitée en OSINT.`],
    annee: [
      `Ton mot de passe contient une année → un pirate teste toutes les années de 1950 à ${annee}, ça lui prend une fraction de seconde.`,
      `Année plausible (1950–${annee}) : espace de recherche de quelques dizaines d'essais.`],
    sequence_clavier: [
      `Ton mot de passe suit les touches du clavier (comme « azerty ») → c'est la toute première chose qu'un pirate essaie.`,
      `Marche clavier (AZERTY/QWERTY) : présente en tête de toutes les listes d'attaque.`],
    leet: [
      `Remplacer des lettres par des chiffres (a→4, e→3…) ne trompe pas les pirates : leurs outils le prévoient.`,
      `Substitution « leet speak » : normalisée automatiquement par les outils de cassage (règles de mutation).`],
    repetition: [
      `Des caractères ou des blocs qui se répètent (aaa, 1212) réduisent énormément les possibilités à tester.`,
      `Motif répété détecté : réduit fortement l'entropie effective malgré la longueur apparente.`],
    mot_commun: [
      `Ton mot de passe contient un mot très courant (prénom, ville, club…) qui figure dans les dictionnaires des pirates.`,
      `Mot présent dans un dictionnaire généraliste (prénoms/villes/clubs courants).`],
    schema_maj_annee: [
      `Le schéma « Majuscule + mot + année + ! » est tellement répandu qu'il est testé en priorité par les outils.`,
      `Schéma structurel classique (Mot+Année+Ponctuation) : couvert par les règles de mutation standard.`],
  };
  return T[code][mode === "expert" ? 1 : 0];
}

export const PATTERN_LABELS: Record<PatternCode, string> = {
  prenom: "Prénom", nom: "Nom de famille", date_naissance: "Date de naissance", ville: "Ville",
  animal: "Animal", club: "Club de foot", copain: "Copain/copine", annee: "Année",
  sequence_clavier: "Suite clavier", leet: "Leet speak", repetition: "Répétition",
  mot_commun: "Mot courant", schema_maj_annee: "Schéma classique",
};
