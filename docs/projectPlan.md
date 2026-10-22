# Projektplan: SquadTime

## Projektziel
Ein Koop-Planer für Gaming-Gruppen. Die App ermittelt Spiele, die in ein definiertes Zeitbudget passen, bestimmte Qualitätskriterien erfüllen und von keinem der teilnehmenden Nutzer bereits gespielt oder abgelehnt wurden.

---

## Der Tech-Stack
* **Sprache:** TypeScript (zur strikten Typisierung der API-Daten).
* **Styling:** Tailwind CSS (für die effiziente Umsetzung des User Interfaces).
* **Schnittstelle:** RAWG Video Games API (Datenquelle für Spiele, Spielzeiten, Ratings und Review-Anzahlen).
* **Datenbank:** Relationale DB (z. B. PostgreSQL oder MySQL) zur Speicherung der User-Profile und Spiele-Zustände.

---

## Die Kern-Features (MVP)
* **Parameter-Eingabe:** Festlegung von verfügbarer Zeit (z. B. 10 Stunden), Mindestwertung (z. B. 80 %) und Review-Anzahl (z. B. 500+).
* **Qualitätsfilter:** Automatischer Ausschluss von Spielen unterhalb der definierten Bewertungskriterien.
* **Blacklist-Logik:** Abgleich der API-Ergebnisse mit der internen Datenbank. Spiele, die ein ausgewählter Teilnehmer mit dem Status "Durchgespielt" oder "Veto" versehen hat, werden iterativ ausgeschlossen.
* **Dashboard:** Visuelle Darstellung der ermittelten Spiele in einem strukturierten Card-Layout.

---

## Grober Datenbank-Entwurf

*Hinweis: Die primären Spieldaten werden über die externe API abgerufen. In der Datenbank werden ausschließlich die User-Daten sowie die API-IDs der Spiele gespeichert, um Redundanzen zu vermeiden.*

| Tabellen-Name | Funktion | Wichtige Spalten |
| :--- | :--- | :--- |
| **Users** | Speichert die Nutzerprofile. | `id`, `username`, `avatar_url` |
| **User_Games** | n:m Beziehung: Speichert den Status eines Nutzers zu einem bestimmten Spiel. | `id`, `user_id`, `api_game_id`, `status` (*Enum: Gespielt, Veto, Besitze ich*) |
| **Sessions** *(Optional)*| Speichert Parameter und Teilnehmer einer vergangenen oder geplanten Suchanfrage. | `id`, `date`, `max_playtime`, `selected_users` |

---

## Die Meilensteine (Arbeitspakete)

### Modul 1: Grundstruktur (Datenbank & User)
- [ ] Projekt aufsetzen (TypeScript konfigurieren, Tailwind einbinden).
- [ ] Datenbank initiieren und die Tabellen `Users` und `User_Games` anlegen.
- [ ] Frontend-Formular erstellen, über das Nutzer Spiele mittels ID auf ihre persönliche Blacklist setzen können.

### Modul 2: Datenbeschaffung (API & Typen)
- [ ] RAWG API Key generieren und als Umgebungsvariable einrichten.
- [ ] TypeScript-Interfaces für die JSON-Antworten der API definieren (z. B. für `Game`, `Rating`, `Playtime`).
- [ ] Fetch-Funktion implementieren, welche die REST-Parameter nutzt: *Genres=Coop, Playtime <= X, Rating >= Y, Reviews >= Z*.

### Modul 3: Matchmaking-Algorithmus
- [ ] Frontend-Komponente zur Auswahl der beteiligten Nutzer für eine Session erstellen.
- [ ] Die Blacklists der ausgewählten Nutzer aus der Datenbank abrufen und zu einer globalen Ausschluss-Liste zusammenführen.
- [ ] Die gefilterten API-Ergebnisse mit der Ausschluss-Liste abgleichen und finale Ergebnismenge ermitteln.

### Modul 4: User Interface (Tailwind CSS)
- [ ] Dashboard-Layout umsetzen.
- [ ] Suchparameter als interaktive UI-Elemente (Slider, Dropdowns) integrieren.
- [ ] Gefilterte Ergebnisse als Card-Komponenten rendern (inklusive Cover-Bild, Metacritic-Score und geschätzter Spielzeit).






