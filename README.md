# 🛡️ SupremeBot Gestion — V3.0 (JavaScript / Discord.js v14)

Bot Discord complet de gestion, modération avancée, sécurisation anti-raid, système de tickets personnalisable, **système de bienvenue dynamique**, **Auto-Rôle automatique** et **attribution massive de rôles (+massivrole)**.

## ⚡ Préfixe
Le préfixe configuré est **`+`**.

---

## 🎭 Gestion Avancée des Rôles & Permissions

### 1. Attribution & Révocation de Rôle (`+addrole` / `+delrole`)
- `+addrole <id_rôle|@rôle> <id_membre|@membre>` : Attribue un rôle à un utilisateur. Fonctionne dans n'importe quel ordre d'argument.
- `+set addrole` : Ouvre un panneau interactif pour configurer le rôle autorisé à exécuter `+addrole` (ou Administrateurs uniquement).
- `+delrole <id_rôle|@rôle> <id_membre|@membre>` : Retire un rôle existant d'un utilisateur.
- `+set delrole` : Ouvre un panneau interactif pour configurer le rôle autorisé à exécuter `+delrole`.

### 2. Module Derank avec Rôle Protégé (`+derank` / `+set derank`)
- `+derank <@membre|id>` : Révoque tous les rôles modifiables du membre cible d'un seul coup.
- `+set derank` : Ouvre le panneau de configuration interactif à double sélecteur natif :
  - **Rôle Autorisé :** Rôle autorisé à effectuer la commande `+derank`.
  - **Rôle Protégé :** Rôle qui ne sera **JAMAIS retiré** lors d'un derank (ex: rôle *Membre*, *Citoyen*, *Joueur*).
  - **Particularité :** Si le rôle protégé est laissé vide, la commande `+derank` retire **100% des rôles** !

### 3. Interdiction & Blacklist de Rôle (`+blrank` / `+unblrank`)
- `+blrank <id_rôle|@rôle> <id_membre|@membre>` : Interdit formellement à un membre de détenir un rôle spécifique.
  - **Révocation immédiate :** Si l'utilisateur possède actuellement le rôle, il lui est immédiatement retiré.
  - **Protection en temps réel :** Si quiconque (ou un bot) tente de lui réattribuer ce rôle, le bot l'intercepte et le révoque instantanément (`guildMemberUpdate`).
  - **Verrouillage `+addrole` :** La commande `+addrole` bloque toute attribution d'un rôle blacklisté.
- `+unblrank <id_rôle|@rôle> <id_membre|@membre>` : Supprime la restriction et autorise de nouveau l'attribution du rôle.
- `+blrank list` : Affiche l'ensemble des membres et rôles blacklistés sur le serveur.
- `+blrank list @membre` : Affiche les rôles interdits pour un membre précis.
- **Persistance :** Sauvegarde immédiate dans `data.json`.

### 4. Auto-Rôle Automatique (`+set autorole`)
- `+set autorole` ou `+autorole` : Ouvre le **panneau de configuration interactif** muni d'un sélecteur natif Discord de rôles (`RoleSelectMenu`) et d'un bouton de désactivation.
- `+set autorole @rôle` ou `+set autorole <id>` : Active immédiatement l'attribution automatique pour chaque nouvel arrivant.
- `+set autorole off` : Désactive l'auto-rôle.
- **Persistance :** Sauvegardé automatiquement dans `data.json` et conservé après chaque reboot du bot.

### 4. Attribution Massive de Rôle (`+massivrole`)
- `+massivrole <id_du_rôle ou @rôle>` : Attribue en un éclair le rôle spécifié à **l'ensemble des membres du serveur** (réservé aux Administrateurs).

---

## 🛡️ Sécurité Anti-Raid & Dashboard (`+antiraid` / `+securite`)

Ouvrez le **Dashboard Anti-Raid interactif** via `+antiraid` ou `+securite` pour activer/désactiver les modules en 1 clic :
- `+antiraid` ou `+securite` : Affiche le panneau avec statuts temps réel et boutons à bascule.
- `+antispam <on|off>` : Mute automatique les floodeurs (5+ messages en 5 secondes).
- `+antilink <on|off>` : Suppression immédiate de tous les liens d'invitation Discord.
- `+antibot <on|off>` : Expulsion automatique instantanée des bots non autorisés ajoutés au serveur.
- `+antimention <on|off> [max]` : Sanctionne les utilisateurs abusant des mentions massives.
- `+antichannel <on|off>` : Protection et traçage contre la suppression sauvage de salons.
- `+antirole <on|off>` : Protection et alertes contre la suppression intempestive de rôles.
- `+antiban <on|off>` : Détecte et bloque les raids de bannissements massifs par des staffs corrompus.

---

## 👋 Système de Bienvenue Dynamique (`+set welcome`)
Message par défaut conforme à votre capture :
```text
👋 Salut {user} bienvenue sur **{server}** on est maintenant {count} **grâce à toi**
```
- `+set welcome` : Panneau interactif avec sélecteur de salon, modal de modification, bouton de test et reset.
- `+set welcome [#salon] [message]` : Configuration rapide (message de capture automatique si omis).
- Variables : `{user}`, `{server}`, `{count}`.

---

## 🎫 Système de Tickets 100% Personnalisable

### 📁 Routage Multi-Catégories Discord (Nouveau !)
Chaque motif de ticket peut être créé dans **son propre salon catégorie Discord** distinct :
- Bouton **`📁 Salon Catégorie`** dans `+ticket config` :
  - **Étape 1 :** Vous choisissez pour quel motif vous voulez assigner une catégorie (ou la catégorie globale par défaut).
  - **Étape 2 :** Vous sélectionnez la catégorie Discord hôte dédiée.
- Commande rapide : `+ticket setcat <nom_motif> <id_catégorie_discord>` (ex: `+ticket setcat recrutement 1567990545979146240`).
- Affichage clair dans le dashboard : chaque motif indique sa catégorie Discord attitrée.

### Commandes Tickets :
- `+ticket config` : Panneau interactif complet (Modals d'ajout/suppression de motifs, sélecteurs natifs de rôle staff et catégories Discord).
- `+ticket addcat <emoji> <nom> | <description>` : Ajoute un nouveau motif de ticket.
- `+ticket delcat <nom>` : Supprime un motif de ticket.
- `+ticket listcat` : Liste vos catégories de ticket et leurs catégories Discord hôtes.
- `+ticket setcat <nom_motif> <id_catégorie>` : Assigne directement une catégorie Discord à un motif.
- `+ticket send [#salon]` : Déploie le panneau public interactif de création de tickets.

---

## 🛡️ Modération & Sanctions
- `+ban <@user> [raison]` : Bannissement définitif avec motif.
- `+tempban <@user> <minutes> [raison]` : Bannissement temporaire minuté avec débannissement automatique.
- `+unban <id>` : Débannissement par ID utilisateur.
- `+kick <@user> [raison]` : Expulsion du serveur.
- `+mute / +tempmute <@user> <minutes> [raison]` : Exclusion temporaire native Discord (Timeout).
- `+unmute <@user>` : Réactivation immédiate de la parole.
- `+warn <@user> <raison>` : Attribution d'un avertissement formel.
- `+warnings [@user]` : Consultation du casier d'infractions d'un membre.
- `+note <@user> <texte>` : Ajout d'une note interne confidentielle de modération.
- `+notes <@user>` : Consultation de toutes les notes staff sur le membre.
- `+clear <1-100>` : Suppression en bloc des messages du salon.

---

## 🔒 Salons & Sécurité Anti-Raid
- `+lock [salon]` : Verrouillage du salon en écriture.
- `+unlock [salon]` : Déverrouillage du salon.
- `+hide [salon]` : Salon rendu invisible pour les membres standards.
- `+unhide [salon]` : Rétablissement de la visibilité.
- `+renew / +nuke` : Recréation instantanée à l'identique du salon (purge totale).
- `+slowmode <secondes>` : Réglage du mode lent (0 pour désactiver).
- `+antiraid <status|on|off>` : Contrôle du moteur anti-raid (anti-lien d'invitation, anti-mass mention, anti-spam).

---

## 🚀 Démarrage Rapide

1. Installez les dépendances :
```bash
npm install
```

2. Créez votre fichier `.env` avec votre token de bot :
```env
DISCORD_TOKEN=votre_token_secret_ici
```

3. Activez les **Privileged Gateway Intents** sur le portail [Discord Developer](https://discord.com/developers/applications) :
   - `Server Members Intent`
   - `Message Content Intent`

4. Lancez le bot :
```bash
node index.js
```
