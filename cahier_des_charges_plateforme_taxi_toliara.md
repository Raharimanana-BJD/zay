# Cahier des charges fonctionnel

## Plateforme de réservation de taxis à Toliara --- Madagascar

**Version :** 1.0\
**Statut :** Document de cadrage fonctionnel --- conception, avant
développement\
**Périmètre géographique initial :** Toliara (Tuléar), Madagascar\
**Types de véhicules du lancement :** taxis automobiles et tuk-tuks

------------------------------------------------------------------------

## 1. Présentation du projet

### 1.1. Contexte

Le projet consiste à concevoir une plateforme numérique de réservation
de transport urbain à Toliara. Elle met en relation des clients
souhaitant effectuer un déplacement et des chauffeurs de taxis
automobiles ou de tuk-tuks.

La solution doit tenir compte du contexte local : qualité variable de la
connexion Internet, précision parfois limitée de la géolocalisation,
adresses postales peu structurées, diversité des repères locaux,
disponibilité de smartphones d'entrée de gamme et importance du paiement
en espèces.

Le service ne doit pas se limiter à afficher des chauffeurs sur une
carte. Il doit permettre de demander une course, de recevoir et comparer
des propositions, de convenir d'un prix, de suivre le chauffeur, de
réaliser le trajet et d'enregistrer le paiement.

### 1.2. Vision

Créer une solution de mobilité urbaine simple, fiable, accessible et
adaptée à Toliara, qui facilite la mise en relation entre passagers et
chauffeurs tout en donnant de la visibilité sur le véhicule, le prix et
le déroulement de la course.

### 1.3. Objectifs

-   Simplifier la recherche et la réservation d'un taxi.
-   Intégrer les taxis automobiles et les tuk-tuks dans une même
    plateforme.
-   Permettre au client de choisir une catégorie ou de rechercher
    automatiquement les deux.
-   Donner une estimation de prix avant la confirmation.
-   Permettre une négociation encadrée du prix.
-   Améliorer la visibilité sur l'arrivée du chauffeur et le déroulement
    de la course.
-   Fournir aux chauffeurs un outil de gestion de leur disponibilité et
    de leurs courses.
-   Donner à l'administration les moyens de vérifier les comptes,
    superviser les réservations et configurer le service.
-   Concevoir une application légère et utilisable malgré une connexion
    instable.

### 1.4. Périmètre géographique

Le lancement est prévu à **Toliara**. La zone précise de couverture, les
quartiers desservis, les limites de prise en charge et les destinations
autorisées restent à définir à partir d'une étude terrain.

Le déploiement dans d'autres villes n'appartient pas au MVP.

------------------------------------------------------------------------

## 2. Périmètre fonctionnel

La solution comprend trois interfaces principales :

1.  **Application Client** : recherche, réservation, suivi et historique
    des courses.
2.  **Application Chauffeur** : disponibilité, réception des demandes,
    gestion des courses et suivi des revenus.
3.  **Back-office web Administration** : validation des chauffeurs et
    véhicules, supervision, gestion et configuration de la plateforme.

### 2.1. Catégories de transport

Catégories incluses au lancement :

-   Taxi automobile.
-   Tuk-tuk.

Catégories exclues du périmètre initial :

-   Cyclo-pousse.
-   Taxi-be.

Le client peut : - sélectionner manuellement « Voiture » ; -
sélectionner manuellement « Tuk-tuk » ; - choisir le mode « Automatique
», dans lequel la plateforme recherche les deux catégories et présente
les propositions disponibles.

**Règle impérative :** si le client sélectionne une catégorie précise,
la plateforme ne doit pas lui attribuer un véhicule d'une autre
catégorie. En mode automatique, le type de véhicule doit être clairement
affiché pour chaque proposition.

------------------------------------------------------------------------

## 3. Utilisateurs et rôles

### 3.1. Client

Le client peut : - créer un compte et se connecter ; - définir un point
de départ et une destination ; - choisir une catégorie de véhicule ; -
indiquer le nombre de passagers ; - consulter les propositions de
chauffeurs et leurs prix ; - négocier dans les limites prévues ; -
confirmer une réservation ; - suivre le chauffeur ; - contacter le
chauffeur ; - annuler une réservation selon son état ; - consulter ses
courses passées ; - signaler un problème.

### 3.2. Chauffeur

Un compte chauffeur peut correspondre à l'une des situations
professionnelles suivantes :

-   **Propriétaire** : le chauffeur possède son véhicule.
-   **Locataire** : le chauffeur utilise un véhicule loué.
-   **Salarié ou affilié** : le chauffeur travaille pour un propriétaire
    ou une structure.

Il s'agit d'un seul type de compte chauffeur, avec un attribut indiquant
sa relation professionnelle. Cette information pourra notamment servir
aux futurs outils de suivi des revenus et des charges.

Le chauffeur peut : - créer et compléter son profil ; - transmettre ses
documents ; - enregistrer un ou plusieurs véhicules, sous réserve des
règles de validation ; - consulter l'état de validation de son compte et
de ses véhicules ; - se mettre en ligne ; - activer ou désactiver sa
disponibilité pour recevoir des demandes ; - recevoir des demandes ; -
accepter le tarif indicatif ou proposer un autre prix ; - répondre aux
contre-propositions ; - rejoindre le lieu de prise en charge ; -
signaler son arrivée ; - démarrer et terminer une course ; - consulter
son historique et ses revenus ; - signaler un incident ou contacter le
support.

**Règle :** un chauffeur ne peut avoir qu'une seule course active à la
fois.

### 3.3. Administrateur

L'administrateur peut : - consulter et gérer les comptes ; - valider ou
rejeter les chauffeurs ; - valider ou rejeter les véhicules et documents
; - suspendre ou réactiver un compte ; - consulter et superviser les
réservations ; - consulter les annulations et leurs motifs ; - traiter
les réclamations et signalements ; - configurer les tarifs et paramètres
de distribution ; - gérer les catégories et zones de couverture ; -
consulter les statistiques disponibles.

### 3.4. Support / modérateur

Un rôle de support ou modérateur est envisagé. Ses droits devront être
limités aux fonctions nécessaires : consultation des réservations, suivi
des incidents et traitement des réclamations, sans accès systématique
aux paramètres sensibles de la plateforme.

Les permissions détaillées seront définies avant le développement du
back-office.

------------------------------------------------------------------------

## 4. Application Client

### 4.1. Espaces principaux

L'application Client comprend les espaces fonctionnels suivants :

-   **Accueil / réservation** : saisie du trajet et lancement d'une
    recherche.
-   **Carte** : visualisation du départ, de la destination et du
    chauffeur.
-   **Réservation / suivi** : propositions, prix, confirmation et suivi
    de course.
-   **Courses** : historique des déplacements.
-   **Favoris** : lieux fréquents, envisagés pour une version
    ultérieure.
-   **Profil** : informations personnelles, langue et assistance.

### 4.2. Création d'une demande

Le client renseigne :

1.  Le point de départ.
2.  La destination.
3.  La catégorie de véhicule : voiture, tuk-tuk ou automatique.
4.  Le nombre de passagers.

Les moyens de renseigner un lieu peuvent inclure : - position GPS ; -
déplacement d'un repère sur une carte ; - choix d'un quartier ; -
sélection d'un point de repère local ; - description textuelle
complémentaire.

Une adresse postale exacte ne doit pas être obligatoire. L'interface
doit permettre au client de préciser un lieu de rendez-vous
compréhensible localement.

### 4.3. Compatibilité du véhicule

Le nombre de passagers doit être compatible avec la capacité déclarée et
validée du véhicule. La plateforme ne doit pas présenter une proposition
dont la capacité est insuffisante.

Les capacités autorisées et les éventuelles restrictions propres aux
voitures et aux tuk-tuks devront être configurées et vérifiées selon les
règles locales applicables.

### 4.4. Affichage des propositions

Pour chaque proposition, le client doit pouvoir consulter au minimum : -
catégorie du véhicule ; - informations d'identification du chauffeur ; -
photo du véhicule, si disponible ; - tarif indicatif ou prix proposé ; -
distance et estimation d'arrivée, si disponibles ; - informations utiles
sur le point de prise en charge.

En mode automatique, les propositions de voitures et de tuk-tuks doivent
être identifiées sans ambiguïté.

Le client conserve le choix final. La recherche de chauffeurs ne vaut
pas réservation automatique.

### 4.5. Suivi de la course

Après confirmation, le client peut consulter : - l'identité du chauffeur
; - le véhicule attribué ; - la position du chauffeur ; - son état
d'avancement ; - le moyen de contacter le chauffeur.

Si la position GPS n'est plus actualisée, l'application doit afficher la
dernière position connue ou signaler que la position n'est plus à jour.
Elle ne doit pas présenter une ancienne position comme une position
actuelle.

### 4.6. Historique et assistance

Le client peut consulter les courses précédentes et leurs informations
essentielles : date, départ, destination, catégorie, prix convenu et
état du paiement.

Il doit pouvoir signaler un problème ou demander de l'aide.

Les favoris et la réservation anticipée sont envisagés pour une version
ultérieure.

------------------------------------------------------------------------

## 5. Application Chauffeur

### 5.1. Espaces principaux

L'application Chauffeur comprend les espaces suivants :

-   **Accueil** : état de disponibilité, demandes entrantes et résumé
    d'activité.
-   **Courses** : demandes reçues, course active et historique.
-   **Navigation** : départ, destination et itinéraire.
-   **Revenus** : recettes journalières et historique.
-   **Véhicule** : catégorie, caractéristiques, photos et documents.
-   **Profil** : identité, téléphone, relation professionnelle,
    paramètres et assistance.

### 5.2. Compte et validation

Le chauffeur doit fournir les informations et justificatifs demandés par
la plateforme. Il ne peut recevoir des demandes que lorsque son compte
et le véhicule concerné ont été validés.

Les pièces exactes, leur durée de validité et les règles de contrôle
devront être établies en tenant compte de la réglementation applicable à
Madagascar et des pratiques locales.

### 5.3. Informations sur les véhicules

Pour une voiture, les informations envisagées sont : - marque ; - modèle
; - immatriculation ; - photo ; - capacité en passagers ; - équipements
ou caractéristiques utiles.

Pour un tuk-tuk : - modèle ou type ; - immatriculation, si applicable
; - photo ; - capacité en passagers ; - restrictions ou caractéristiques
de circulation.

La plateforme doit permettre à l'administration de configurer les
catégories, capacités et informations exigées.

### 5.4. Disponibilité du chauffeur

Deux états doivent être distingués :

-   **En ligne** : le chauffeur est connecté à la plateforme.
-   **Disponible** : le chauffeur a explicitement activé la réception de
    demandes.

Un chauffeur connecté mais non disponible ne doit pas recevoir de
proposition de course.

Le chauffeur en course ne doit pas recevoir une nouvelle demande.

### 5.5. Gestion d'une course

Le chauffeur doit pouvoir : - recevoir une demande ; - consulter les
détails du trajet et le prix indicatif ; - accepter le prix indicatif ou
proposer un autre prix ; - répondre à une contre-proposition ; -
confirmer qu'il se dirige vers le client ; - signaler son arrivée ; -
confirmer la prise en charge et le démarrage ; - terminer la course ; -
renseigner les informations de paiement ; - signaler un incident.

L'interface doit limiter les manipulations pendant la conduite et
privilégier des actions simples et lisibles.

### 5.6. Revenus

Le chauffeur doit pouvoir consulter ses recettes et l'historique de ses
courses. Pour le MVP, le suivi peut se concentrer sur les montants
convenus et les montants déclarés comme encaissés.

Les outils détaillés de dépenses, loyers journaliers, maintenance et
gestion de flotte sont à approfondir pour une version ultérieure.

------------------------------------------------------------------------

## 6. Back-office web Administration

### 6.1. Modules

Le back-office doit comporter les modules suivants :

1.  Tableau de bord.
2.  Gestion des clients.
3.  Gestion des chauffeurs.
4.  Gestion des véhicules et documents.
5.  Gestion des réservations.
6.  Réclamations et signalements.
7.  Tarification et paramètres.
8.  Zones de couverture.
9.  Statistiques et rapports.
10. Gestion des rôles et accès.

### 6.2. Validation des chauffeurs et véhicules

L'administrateur doit pouvoir : - consulter les informations du
chauffeur ; - consulter les documents transmis ; - consulter les
informations du véhicule ; - approuver ou rejeter un dossier ; -
demander une correction ou un complément ; - suspendre un chauffeur ou
un véhicule ; - consulter l'historique des décisions.

Un chauffeur ou un véhicule non validé ne doit pas être éligible à la
distribution des demandes.

### 6.3. Supervision des réservations

L'administration doit pouvoir consulter les réservations et leur état
: - demande créée ; - recherche en cours ; - propositions envoyées ; -
chauffeur attribué ; - chauffeur en route ; - chauffeur arrivé ; -
course en cours ; - course terminée ; - course annulée ou contestée.

Les motifs d'annulation et les événements importants doivent être
historisés.

### 6.4. Configuration

Les paramètres de tarification et de distribution doivent être
modifiables depuis le back-office, sans mise à jour obligatoire des
applications mobiles.

Les changements de paramètres sensibles doivent être enregistrés dans un
journal d'audit.

------------------------------------------------------------------------

## 7. Parcours fonctionnel d'une réservation

### 7.1. Parcours Client

1.  Le client ouvre l'application.
2.  Il indique le point de départ.
3.  Il indique la destination.
4.  Il choisit voiture, tuk-tuk ou recherche automatique.
5.  Il renseigne le nombre de passagers.
6.  La plateforme calcule un tarif indicatif.
7.  La plateforme recherche des chauffeurs éligibles.
8.  Le client reçoit les propositions disponibles.
9.  Il compare les chauffeurs, catégories et prix.
10. Il accepte une proposition ou négocie dans les limites autorisées.
11. Le serveur confirme le chauffeur et verrouille le prix.
12. Le client suit l'arrivée du chauffeur.
13. Le chauffeur signale son arrivée et la prise en charge.
14. La course commence.
15. Le chauffeur termine la course.
16. Le paiement est déclaré et son statut est enregistré.
17. Le client peut consulter la course dans son historique.

### 7.2. Parcours Chauffeur

1.  Le chauffeur se connecte.
2.  Il passe en ligne et active sa disponibilité.
3.  Il reçoit une demande.
4.  Il consulte le départ, la destination, la catégorie et le tarif
    indicatif.
5.  Il accepte le tarif ou propose un autre montant.
6.  Il répond à une éventuelle contre-proposition.
7.  Si le client confirme son offre, le serveur attribue la course.
8.  Le chauffeur rejoint le client.
9.  Il signale son arrivée.
10. Il confirme la prise en charge.
11. Il démarre puis termine la course.
12. Il renseigne le montant encaissé et le statut du paiement.

### 7.3. Confirmation obligatoire

La réservation n'est confirmée que lorsque : - le client a choisi une
proposition ; - le client et le chauffeur sont d'accord sur le prix ; -
le serveur a validé l'attribution ; - le chauffeur n'est pas déjà engagé
dans une autre course.

Une simple réponse positive du chauffeur à la demande initiale ne suffit
pas à confirmer la réservation.

------------------------------------------------------------------------

## 8. Système d'attribution des chauffeurs

### 8.1. Modèle retenu

Le système utilise une distribution hybride par groupes de chauffeurs.

Paramètres initiaux validés :

  Paramètre                            Valeur
  ----------------------------- -------------
  Chauffeurs par groupe                 2 à 3
  Délai de réponse par groupe     20 secondes
  Pause entre groupes              3 secondes
  Nombre maximum de groupes                 4
  Durée théorique maximale        89 secondes

La durée théorique maximale correspond à quatre périodes de 20 secondes
et trois pauses de 3 secondes, hors latence et traitements techniques.

### 8.2. Constitution des groupes

La plateforme sélectionne des chauffeurs éligibles selon : -
disponibilité explicite ; - catégorie de véhicule compatible ; -
capacité suffisante ; - compte et véhicule validés ; - absence de course
active ; - zone et distance ; - qualité et fraîcheur de la position GPS.

Un groupe comprend jusqu'à trois chauffeurs lorsque suffisamment de
candidats sont disponibles ; sinon, il peut en comprendre deux.

Les critères de classement ne doivent pas reposer uniquement sur la
proximité. Une logique d'équité de distribution pourra être étudiée.

### 8.3. Réponse des chauffeurs

Les chauffeurs d'un même groupe reçoivent la demande simultanément et
disposent de 20 secondes pour répondre.

-   Une proposition expirée ne peut plus être acceptée.
-   Un chauffeur ayant refusé une demande ne doit pas recevoir à nouveau
    cette même demande.
-   Si tous les chauffeurs du groupe refusent avant la fin du délai, le
    système peut passer immédiatement au groupe suivant.
-   Si aucun chauffeur ne répond, le groupe expire à la fin des 20
    secondes.
-   Une pause de 3 secondes est appliquée avant le groupe suivant.
-   Le processus s'arrête lorsqu'une réservation est confirmée ou que
    les quatre groupes ont été traités.

### 8.4. Comparaison et sélection

Les propositions reçues d'un groupe sont présentées au client afin qu'il
puisse les comparer. Le client choisit une proposition. La plateforme ne
doit pas attribuer automatiquement la course au premier chauffeur qui
répond.

Le serveur doit effectuer une attribution atomique : un seul chauffeur
peut être confirmé pour une réservation. Les autres propositions
deviennent caduques dès que l'attribution est confirmée.

### 8.5. Catégorie demandée

-   En mode voiture, seuls les chauffeurs de voiture sont recherchés.
-   En mode tuk-tuk, seuls les chauffeurs de tuk-tuk sont recherchés.
-   En mode automatique, les deux catégories peuvent être recherchées et
    comparées.
-   Le type de véhicule doit être visible avant confirmation.

### 8.6. Absence de chauffeur

Si aucun chauffeur n'est disponible après les groupes prévus, le client
est informé que la recherche n'a pas abouti. Il peut modifier sa demande
ou l'annuler.

------------------------------------------------------------------------

## 9. Tarification --- modèle D

### 9.1. Principe retenu

Le modèle tarifaire est hybride :

-   la plateforme calcule un tarif indicatif ;
-   le chauffeur peut accepter ce tarif ou proposer un autre montant ;
-   le client peut accepter, refuser ou faire une contre-proposition ;
-   le prix définitif nécessite l'accord des deux parties.

Le prix est affiché en ariary (Ar).

### 9.2. Calcul du tarif indicatif

La formule de référence est :

**Tarif indicatif = tarif de base + (distance facturable × prix au
kilomètre)**

Les paramètres sont distincts selon la catégorie : - tarif de base
voiture ; - tarif kilométrique voiture ; - tarif de base tuk-tuk ; -
tarif kilométrique tuk-tuk ; - distance minimale éventuellement incluse
; - règle d'arrondi.

La distance utilisée est celle de l'itinéraire estimé par le service de
cartographie. Les règles de calcul exactes, les distances minimales et
les arrondis restent à définir.

Les montants réels ne sont pas encore fixés. Ils devront être déterminés
à partir d'une enquête locale auprès des chauffeurs et des passagers de
Toliara.

### 9.3. Variation autorisée

La variation maximale validée est de **±20 % du tarif indicatif**.

Exemple purement illustratif pour un tarif indicatif de 5 000 Ar :

  Limite                        Montant
  -------------------------- ----------
  Minimum autorisé (-20 %)     4 000 Ar
  Tarif indicatif              5 000 Ar
  Maximum autorisé (+20 %)     6 000 Ar

Le serveur doit vérifier cette limite pour toute proposition et
contre-proposition. Une valeur située en dehors de la fourchette est
rejetée.

La limite est un paramètre configurable par l'administration, avec 20 %
comme valeur initiale validée.

### 9.4. Proposition du chauffeur

Le chauffeur peut : - accepter le tarif indicatif ; - proposer un autre
prix dans la fourchette autorisée.

Un motif d'ajustement peut être demandé, par exemple : - distance réelle
différente de l'estimation ; - route difficile d'accès ; - destination
difficile d'accès ; - autre raison.

La liste des motifs et leur caractère obligatoire restent à finaliser.

### 9.5. Négociation

La règle validée est **une contre-proposition maximum par partie**.

Déroulement : 1. Le chauffeur accepte le tarif indicatif ou propose un
autre prix. 2. Le client accepte, refuse ou soumet une
contre-proposition. 3. Le chauffeur accepte ou refuse cette
contre-proposition, ou formule sa dernière proposition. 4. Le client
accepte ou refuse la dernière proposition.

Aucune négociation supplémentaire n'est autorisée.

Délais de réponse retenus dans la proposition fonctionnelle : -
chauffeur : 20 secondes pour répondre à la demande initiale ; - client :
30 secondes pour répondre à une proposition ; - chauffeur : 30 secondes
pour répondre à une contre-proposition.

Ces délais de négociation sont des valeurs proposées à confirmer lors
des tests terrain. Le délai initial de 20 secondes pour répondre à une
demande de course est, lui, validé.

### 9.6. Comparaison des propositions

Le client peut comparer plusieurs propositions reçues du même groupe
avant de choisir.

Les informations affichées doivent inclure au minimum : - prix proposé
; - catégorie de véhicule ; - chauffeur ; - informations du véhicule ; -
distance ou estimation d'arrivée si disponible.

La comparaison ne doit pas révéler d'informations personnelles non
nécessaires.

### 9.7. Confirmation et verrouillage

Lorsque le client accepte une proposition et que le chauffeur est
d'accord : - le serveur vérifie que la proposition est encore valide ; -
il vérifie que le chauffeur est toujours disponible ; - il confirme
atomiquement l'attribution ; - il enregistre le prix accepté ; - il rend
les autres propositions caduques ; - il notifie le client et le
chauffeur.

Le prix convenu ne peut pas être modifié unilatéralement.

### 9.8. Changement de destination

Si le client change la destination après accord, la plateforme doit
recalculer le tarif et présenter le nouveau montant. La modification ne
s'applique qu'après acceptation explicite du client et du chauffeur.

Les règles précises applicables lorsque le changement intervient pendant
une course restent à définir.

### 9.9. Suppléments

Décision validée pour le MVP : **aucun supplément automatique**.

Ne sont donc pas appliqués automatiquement : - supplément
d'embouteillage ; - supplément météo ; - frais cachés ; - supplément
ajouté après confirmation.

Tout ajustement doit être présenté explicitement et accepté avant son
application.

### 9.10. Données tarifaires à conserver

Pour chaque réservation, conserver : - tarif indicatif initial ; - prix
proposé par chaque chauffeur ; - contre-propositions ; - auteur et
horodatage de chaque action ; - motifs d'ajustement ; - prix final
accepté ; - éventuelles modifications ultérieures et leur validation.

------------------------------------------------------------------------

## 10. Cycle de vie et statuts d'une réservation

### 10.1. Statuts principaux

  Statut              Signification
  ------------------- ----------------------------------------------
  `PENDING`           Demande créée
  `SEARCHING`         Recherche de chauffeurs en cours
  `OFFERED`           Demande proposée à un groupe
  `ACCEPTED`          Chauffeur attribué et réservation confirmée
  `DRIVER_ARRIVING`   Chauffeur en route vers le client
  `ARRIVED`           Chauffeur arrivé au point de prise en charge
  `IN_PROGRESS`       Course en cours
  `COMPLETED`         Course terminée
  `CANCELLED`         Réservation annulée
  `EXPIRED`           Demande ou réservation expirée
  `NO_DRIVER_FOUND`   Aucun chauffeur trouvé
  `DISPUTED`          Course faisant l'objet d'un litige

### 10.2. Transitions

Les transitions doivent être contrôlées côté serveur. Une application
cliente ou chauffeur ne doit pas pouvoir faire passer arbitrairement une
réservation d'un état à un autre.

Exemples : - une demande en recherche ne peut pas passer directement à
`COMPLETED` ; - une course doit être attribuée avant de commencer ; -
une course doit être en cours avant de pouvoir être terminée ; - une
proposition expirée ne peut pas être confirmée.

### 10.3. Annulations et incidents

Les règles suivantes sont retenues : - une annulation est historisée ; -
l'auteur de l'annulation est enregistré ; - un motif est conservé ; -
aucune pénalité financière automatique n'est appliquée au MVP.

Situations à gérer : - client annule avant attribution : arrêt de la
recherche ; - client annule après attribution : le chauffeur est informé
et l'annulation est historisée ; - chauffeur annule avant prise en
charge : le processus de recherche d'un remplaçant doit être défini ; -
client absent : le chauffeur peut signaler son arrivée et l'absence ; -
chauffeur absent : le client peut signaler le problème ; - annulation
pendant une course : possibilité de signalement et intervention du
support.

Les délais d'attente et les règles précises de remplacement restent à
définir.

------------------------------------------------------------------------

## 11. Paiement

### 11.1. Moyen prioritaire

Le paiement en espèces est prioritaire au lancement.

Le Mobile Money est envisagé pour une version ultérieure et ne fait pas
partie du périmètre obligatoire du MVP.

### 11.2. Informations à distinguer

La plateforme doit séparer : 1. le prix convenu ; 2. le montant
réellement payé ; 3. le statut du paiement.

Statuts proposés : - en attente ; - partiellement payé ; - payé ; -
contesté.

La fin d'une course ne signifie pas automatiquement que le paiement a
été reçu.

Le chauffeur doit pouvoir déclarer le montant encaissé. Le client doit
pouvoir signaler un désaccord ou un paiement contesté.

Les procédures de résolution des litiges de paiement restent à
détailler.

------------------------------------------------------------------------

## 12. Notifications et communication

La plateforme doit notifier les utilisateurs des événements importants,
notamment : - nouvelle demande pour un chauffeur ; - proposition
tarifaire reçue ; - contre-proposition ; - acceptation ou refus ; -
réservation confirmée ; - chauffeur en route ; - chauffeur arrivé ; -
course démarrée ; - course terminée ; - annulation ou expiration.

Les appels téléphoniques et éventuellement WhatsApp peuvent compléter la
communication intégrée. Le choix d'un fournisseur de notifications et
les règles de fonctionnement hors connexion seront définis pendant la
conception technique.

Les notifications retardées ne doivent jamais permettre d'accepter une
proposition déjà expirée.

------------------------------------------------------------------------

## 13. Géolocalisation, cartographie et navigation

### 13.1. Localisation

La plateforme utilise la géolocalisation pour : - proposer un point de
départ ; - localiser les chauffeurs ; - calculer une distance estimée
; - afficher le suivi de la course.

### 13.2. Solutions alternatives aux adresses

Compte tenu de la réalité locale, le client doit pouvoir indiquer un
lieu par : - GPS ; - quartier ; - repère local ; - position sur la carte
; - description libre.

### 13.3. Fiabilité GPS et connexion

La plateforme doit : - indiquer lorsque la position est ancienne ; -
distinguer la dernière position connue d'une position actuelle ; -
éviter d'utiliser une position trop ancienne comme si elle était fiable
; - gérer les pertes temporaires de connexion ; - synchroniser les
événements lorsque la connexion revient.

La précision minimale acceptable et la durée maximale de fraîcheur GPS
devront être déterminées lors des tests.

### 13.4. Zones de service

Il faudra distinguer : - les zones dans lesquelles une prise en charge
est autorisée ; - les zones dans lesquelles une destination est
autorisée ; - les zones de disponibilité des chauffeurs.

Les limites exactes de couverture de Toliara restent à définir avec les
chauffeurs et les acteurs locaux.

------------------------------------------------------------------------

## 14. Gestion des erreurs et fonctionnement hors connexion

La solution doit être conçue pour des connexions mobiles parfois
instables et des appareils aux ressources limitées.

Règles essentielles : - une course déjà confirmée côté serveur ne doit
pas disparaître à cause d'une perte de connexion ; - les informations
critiques doivent être synchronisées dès que la connexion revient ; -
les actions sensibles doivent être confirmées par le serveur ; - les
doubles clics et doubles soumissions ne doivent pas créer plusieurs
réservations ; - les états affichés doivent refléter la dernière
information fiable ; - les propositions expirées doivent rester non
valides même si une notification arrive tardivement.

Les applications doivent limiter la consommation de données, de
batterie, de mémoire et de stockage.

------------------------------------------------------------------------

## 15. Sécurité, fiabilité et traçabilité

Les exigences fonctionnelles de sécurité comprennent : -
authentification des clients, chauffeurs et administrateurs ; - contrôle
des rôles et permissions ; - validation des chauffeurs et véhicules
avant accès aux demandes ; - protection des données personnelles ; -
contrôle serveur des prix, attributions et transitions de statut ; -
journalisation des actions sensibles ; - prévention des doubles
attributions ; - conservation des événements importants d'une
réservation.

Les règles de conservation des données, la politique de confidentialité,
les modalités de suppression de compte et les obligations réglementaires
devront être précisées avant le lancement.

------------------------------------------------------------------------

## 16. Langues et accessibilité

Les langues envisagées pour la plateforme sont : - malagasy ; -
français.

Les libellés, messages d'erreur, notifications et informations
tarifaires devront être cohérents dans chaque langue.

L'interface doit : - être simple à comprendre ; - utiliser des textes
courts ; - présenter les montants clairement ; - éviter les
manipulations complexes ; - être lisible sur des écrans de petite taille
; - limiter les actions nécessaires pendant la conduite.

La traduction et la validation des formulations malagasy devront être
réalisées avec des locuteurs compétents et testées auprès des
utilisateurs locaux.

------------------------------------------------------------------------

## 17. Exigences non fonctionnelles

### 17.1. Performance et appareils

-   Fonctionnement correct sur des smartphones Android d'entrée de
    gamme.
-   Interfaces légères et rapides.
-   Consommation limitée de mémoire, batterie, stockage et données.
-   Chargement progressif des informations non essentielles.
-   Gestion des connexions lentes et intermittentes.

### 17.2. Disponibilité et cohérence

-   Les actions critiques sont validées côté serveur.
-   Les réservations ne peuvent pas être attribuées à plusieurs
    chauffeurs.
-   Les prix convenus sont conservés de manière fiable.
-   Les événements sont historisés.
-   Les erreurs réseau ne doivent pas provoquer de transitions métier
    incohérentes.

### 17.3. Utilisabilité

-   Parcours de réservation court.
-   Informations de prix visibles avant confirmation.
-   Identification claire du type de véhicule.
-   Actions chauffeur simples et adaptées à la conduite.
-   Messages explicites en cas d'absence de chauffeur ou d'échec de
    réservation.

------------------------------------------------------------------------

## 18. Découpage des versions

### 18.1. MVP --- première version

Le MVP comprend :

**Application Client** - inscription et connexion ; - création d'une
demande ; - départ et destination ; - choix voiture, tuk-tuk ou
automatique ; - nombre de passagers ; - consultation et comparaison des
propositions ; - négociation tarifaire encadrée ; - confirmation ; -
suivi du chauffeur ; - historique des courses ; - signalement d'un
problème.

**Application Chauffeur** - inscription et profil ; - transmission des
documents ; - véhicule et informations associées ; - disponibilité ; -
réception des demandes ; - proposition et négociation de prix ; -
gestion de course ; - navigation de base ; - déclaration du paiement ; -
historique des courses.

**Back-office** - validation chauffeurs et véhicules ; - gestion des
comptes ; - supervision des réservations ; - gestion des annulations et
signalements ; - configuration tarifaire ; - configuration de la
distribution ; - gestion des zones ; - statistiques essentielles.

**Socle commun** - notifications ; - paiement en espèces ; - gestion des
statuts ; - historique des événements ; - gestion des connexions
instables.

### 18.2. Version 2

Fonctionnalités envisagées : - réservation à l'avance ; - lieux favoris
; - évaluations et avis ; - statistiques de revenus plus détaillées ; -
suivi des dépenses et de la maintenance ; - paiement Mobile Money ; -
promotions.

### 18.3. Version 3

Fonctionnalités envisagées : - extension à plusieurs villes ; - gestion
de flotte et de propriétaires ; - fidélité ; - analyses avancées ; -
tarification avancée ; - partenariats avec des entreprises.

------------------------------------------------------------------------

## 19. Règles métier essentielles récapitulatives

1.  Le lancement concerne Toliara.
2.  Les catégories initiales sont voiture et tuk-tuk.
3.  Le client choisit une catégorie ou le mode automatique.
4.  Une catégorie choisie explicitement ne peut pas être remplacée par
    une autre.
5.  Le client doit toujours connaître le type de véhicule et le prix
    avant de confirmer.
6.  Le chauffeur doit être validé et explicitement disponible.
7.  Un chauffeur ne peut avoir qu'une course active.
8.  La distribution fonctionne par groupes de 2 à 3 chauffeurs.
9.  Le délai de réponse initial est de 20 secondes.
10. La pause entre groupes est de 3 secondes.
11. Quatre groupes maximum sont sollicités.
12. Les propositions d'un groupe sont comparées par le client.
13. Le premier chauffeur qui répond ne gagne pas automatiquement la
    course.
14. Le prix indicatif est calculé par la plateforme.
15. La variation tarifaire autorisée est de ±20 %.
16. Une contre-proposition maximum est autorisée par partie.
17. Aucun supplément automatique n'est appliqué au MVP.
18. Le prix est verrouillé après accord et confirmation serveur.
19. Un changement de destination nécessite un nouveau calcul et un
    nouvel accord.
20. Le paiement en espèces est prioritaire.
21. Prix convenu, montant payé et statut du paiement sont distincts.
22. Les annulations sont historisées, sans pénalité automatique au MVP.
23. Les positions GPS anciennes ne sont pas présentées comme actuelles.
24. Les événements critiques sont confirmés côté serveur.
25. La plateforme doit fonctionner dans des conditions de connexion
    instable.

------------------------------------------------------------------------

## 20. Points restant à étudier et à valider

Les éléments suivants ne doivent pas être considérés comme des décisions
définitives.

### 20.1. Étude terrain et tarification

-   Tarifs de base réels pour voiture et tuk-tuk.
-   Prix au kilomètre par catégorie.
-   Distance minimale incluse.
-   Règle d'arrondi.
-   Pertinence de la limite de ±20 % après essais.
-   Motifs de modification du prix.
-   Temps de réponse client et chauffeur pendant la négociation.
-   Méthode de calcul de distance et choix du fournisseur
    cartographique.

### 20.2. Exploitation locale

-   Quartiers et zones exacts du lancement.
-   Règles de prise en charge et de destination.
-   Capacités autorisées pour chaque catégorie.
-   Documents et vérifications réglementaires nécessaires.
-   Conditions de circulation et restrictions propres aux tuk-tuks.
-   Moyens de communication préférés des utilisateurs.
-   Niveau de couverture réseau et qualité GPS sur les zones ciblées.

### 20.3. Gestion des incidents

-   Temps d'attente du chauffeur au point de départ.
-   Procédure en cas de client absent.
-   Procédure en cas de chauffeur absent.
-   Recherche d'un remplaçant après annulation du chauffeur.
-   Règles en cas de changement de destination pendant la course.
-   Traitement des paiements partiels et contestés.
-   Procédure de réclamation et délais de résolution.

### 20.4. Produit et exploitation

-   Méthode d'inscription et de vérification des clients.
-   Politique de suspension et de réactivation des comptes.
-   Politique de conservation et suppression des données.
-   Modèle économique de la plateforme et éventuelles commissions.
-   Rôles détaillés du back-office.
-   Indicateurs statistiques prioritaires.

------------------------------------------------------------------------

## 21. Critères d'acceptation fonctionnels du MVP

Le MVP pourra être considéré comme fonctionnel lorsque les scénarios
suivants seront validés :

### Scénario A --- Réservation en voiture

-   Un client choisit une voiture.
-   La plateforme calcule un tarif indicatif.
-   Seuls les chauffeurs de voiture éligibles sont sollicités.
-   Le client reçoit et compare les propositions.
-   Le client confirme une offre.
-   Un seul chauffeur est attribué.
-   Le trajet peut être suivi, démarré et terminé.

### Scénario B --- Réservation en tuk-tuk

-   Un client choisit un tuk-tuk.
-   La plateforme calcule le tarif adapté à cette catégorie.
-   Seuls les chauffeurs de tuk-tuk éligibles sont sollicités.
-   Le client ne reçoit pas de proposition de voiture.

### Scénario C --- Recherche automatique

-   Le client choisit le mode automatique.
-   La plateforme peut solliciter des chauffeurs de voiture et de
    tuk-tuk.
-   Les propositions identifient clairement leur catégorie.
-   Le client compare les offres et choisit librement.

### Scénario D --- Négociation tarifaire

-   Le tarif indicatif est affiché.
-   Le chauffeur propose un prix dans la limite de ±20 %.
-   Le client peut accepter, refuser ou faire une contre-proposition.
-   Une seule contre-proposition maximum est autorisée par partie.
-   Le prix final est verrouillé après accord et confirmation serveur.
-   Une proposition hors limite ou expirée est rejetée.

### Scénario E --- Concurrence entre chauffeurs

-   Plusieurs chauffeurs reçoivent une demande du même groupe.
-   Le client peut comparer les propositions.
-   Deux clients ou deux actions concurrentes ne peuvent pas attribuer
    la même course à plusieurs chauffeurs.
-   Dès qu'une attribution est confirmée, les autres propositions
    deviennent caduques.

### Scénario F --- Connexion instable

-   Une course confirmée reste enregistrée même si le téléphone perd
    temporairement la connexion.
-   Les événements critiques se synchronisent au retour du réseau.
-   Une position ancienne est signalée comme telle.
-   Une proposition expirée ne peut pas être acceptée à la suite d'une
    notification tardive.

### Scénario G --- Paiement et annulation

-   La course peut être terminée sans marquer automatiquement le
    paiement comme reçu.
-   Le montant payé est enregistré séparément du prix convenu.
-   Une annulation conserve son auteur et son motif.
-   Aucune pénalité financière automatique n'est appliquée au MVP.

------------------------------------------------------------------------

## 22. Conclusion

Ce cahier des charges définit le périmètre fonctionnel initial de la
plateforme de réservation de taxis à Toliara. Il formalise les trois
interfaces, les parcours client et chauffeur, le système d'attribution,
le modèle tarifaire hybride, le cycle de vie des réservations, le
paiement et les contraintes locales.

Le document constitue une base de conception fonctionnelle avant le
choix détaillé de l'architecture technique et le développement. Les
éléments explicitement identifiés comme restant à étudier devront être
validés, notamment grâce à des échanges avec les chauffeurs et les
passagers de Toliara.

**Aucune technologie, aucun tarif réel et aucune règle réglementaire non
vérifiée ne sont imposés par ce document.**
