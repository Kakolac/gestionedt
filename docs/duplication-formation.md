# Duplication de formation

## Vue d'ensemble

La fonctionnalité de duplication permet de créer rapidement une nouvelle formation en copiant toutes les données d'une formation existante, avec la possibilité de modifier le nom et d'ajuster les autres paramètres avant la création.

## Accès

- Disponible depuis la page **`/administration/creation-formation`**
- Bouton **« Dupliquer »** présent sur chaque ligne du tableau des formations
- Nécessite la même permission que la création de formation : **`feature.creation.formation`**

---

## Utilisation

### Dupliquer une formation

1. Depuis le tableau des formations, cliquer sur le bouton **« Dupliquer »** de la formation à copier.
2. Une modale s'ouvre avec toutes les données pré-remplies :
   - **Nom** : automatiquement préfixé par "Copie de [nom original]" (modifiable)
   - **Description** : copiée de la formation source (modifiable)
   - **Date de démarrage** : copiée de la formation source (modifiable)
   - **Contraintes de planning** : toutes les contraintes sont copiées (modifiables)
   - **Localisation** : pays et région copiés (modifiables)
   - **Dates de vacances** : toutes les périodes de vacances sont copiées (modifiables)
   - **Matières et lignes** : toutes les matières avec leurs heures prévues et professeurs affectés sont copiées
3. **Modifier le nom** ou tout autre champ selon vos besoins.
4. Vous pouvez :
   - Ajouter de nouvelles matières
   - Retirer des matières
   - Modifier les heures prévues
   - Ajuster les contraintes
5. Cliquer sur **« Créer la formation »** pour enregistrer la nouvelle formation.

### Comportement

- La formation dupliquée est **une nouvelle formation indépendante** avec un nouvel identifiant MongoDB.
- Les **matières référencées** sont les mêmes que dans la formation source (ObjectId identiques), ce qui est conforme au modèle où une matière peut appartenir à plusieurs formations.
- Les **professeurs** sont également référencés par leurs ObjectId d'origine.
- Toutes les **contraintes de planning** et **dates de vacances** sont copiées intégralement.

---

## Implémentation technique

### Composants modifiés

#### 1. `CreerFormationModal.tsx`

Le composant a été étendu pour accepter des props optionnelles permettant de pré-remplir tous les champs :

```typescript
type Props = {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  matiereDisponibles: MatiereOptionCourte[];
  professeurOptions: ProfesseurOption[];
  // Nouvelles props optionnelles pour la duplication
  initialNom?: string;
  initialDescription?: string;
  initialLignes?: DraftLigne[];
  initialContraintes?: FormationContrainteWire[];
  initialLocalisationPays?: string;
  initialLocalisationRegion?: string;
  initialDateDemarrage?: string;
  initialDatesVacances?: Array<{ debut: string; fin: string; nom: string }>;
};
```

**Changements clés** :
- Le `useState` pour `lignesDraft` utilise `initialLignes ?? []` pour pré-remplir les matières
- Tous les champs du formulaire utilisent `defaultValue` avec les valeurs initiales
- Les composants `FormationContraintesEditor` et `FormationLocalisationEditor` reçoivent les valeurs initiales

#### 2. `GestionFormationPanel.tsx`

**Ajouts** :
- Nouvelle fonction `rowVersDraftsForDuplicate()` pour convertir une `FormationRow` en tableau de `DraftLigne[]`
- State `duplicateRow` pour stocker la formation à dupliquer
- State `duplicateKey` pour forcer le remontage du composant
- Bouton **« Dupliquer »** dans la colonne Actions (style vert émeraude pour le distinguer)
- Deuxième instance de `CreerFormationModal` dédiée à la duplication avec toutes les données pré-remplies

```typescript
function rowVersDraftsForDuplicate(row: FormationRow): DraftLigne[] {
  return row.lignesListe.map((ligne, idx) => ({
    clientKey: `duplicate-${row.id}-${idx}-${ligne.matiereId}`,
    kind: "existing" as const,
    matiereId: ligne.matiereId,
    matiereNom: ligne.matiereNom,
    professeurIds: [...ligne.professeurIds],
    nombreHeuresPrevues: ligne.nombreHeuresPrevues,
  }));
}
```

### Type exporté

Le type `DraftLigne` a été exporté depuis `CreerFormationModal.tsx` pour être réutilisé dans `GestionFormationPanel.tsx`.

---

## Avantages

1. **Gain de temps** : Plus besoin de ressaisir manuellement toutes les informations d'une formation similaire
2. **Cohérence** : Garantit que toutes les données (contraintes, vacances, etc.) sont copiées correctement
3. **Flexibilité** : L'utilisateur peut modifier n'importe quel champ avant la création
4. **KISS** : Réutilise le composant de création existant sans duplication de code

---

## Différences avec la modification

| Duplication | Modification |
|-------------|--------------|
| Crée une **nouvelle formation** | Modifie la formation **existante** |
| Nom préfixé "Copie de..." | Nom conservé |
| Nouvel ObjectId MongoDB | Même ObjectId |
| Utilise `createFormationAction` | Utilise `updateFormationAction` |

---

## Cas d'usage typiques

1. **Formation récurrente** : Dupliquer une formation d'une année sur l'autre en changeant simplement les dates
2. **Formations similaires** : Créer des variantes d'une même formation (ex: niveau 1, niveau 2) avec des ajustements mineurs
3. **Template** : Utiliser une formation existante comme modèle pour en créer de nouvelles

---

## Limitations et notes

- Le nom est automatiquement préfixé par "Copie de", mais l'utilisateur doit le modifier manuellement s'il souhaite un autre nom
- Les matières référencées sont les **mêmes instances** que dans la formation source (pas de duplication des matières)
- Si une matière ou un professeur référencé a été supprimé entre-temps, la validation côté serveur détectera l'erreur
