# Itowns Inondation

## Formatage des données

Il nous faut :
- redéfinir les types des bâtiments importants
- vérifier si tout les bâtiments industriels ont un attribut "Nature"

Concernant les interactions plus précisément il faut :

- lister les différents types d'interactions existantes
- définir le format de la table (csv VS bdd)

| Id origine (String) | Id cible (String) |   Interaction Double (bool) | Type d'interaction |
| ------------------- |: ---------------: |: -------------------------: | -----------------: |
| 158                 | 785               | false                       | electricDependency |

## Contrôle Souris

L'utilisateur à accès à deux contrôles principaux au moyen de la souris à savoir :

- les informations minimales d'un bâtiment lorsqu'il le survole (mouseover)
- les informations détaillées d'un bâtiment lorsqu'il le sélectionne (click)

Ces comportements par default peuvent être altérés par les fonctions de la Toolbar.

## Toolbar

Nous avons décidé de rajouter des outils à la barre déjà existante. Les outils à ajouter correspondront aux fonctionnalités développées par l'équipe.

Ces outils prennent la forme de boutons on/off couplés à une liste de choix d'interactions (et donc de bâtiments ???).

## Fonctionnalités

Deux fonctionnalités ont été implémentées en plus de celles citées précédemment :

- l'affichage de toutes les dépendances choisies d'un bâtiment en cliquant dessus. Il suffit ensuite de recliquer dessus pour le désélectionner. La multi-sélection sera-t-elle autorisée ???

- l'affichage de tout les bâtiments, dépendant de bâtiments importants inondés, ainsi que des interactions désirées.