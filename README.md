# Gestionale Fede - PMU, Make-up & Spose (Web & Mobile iPhone)

Gestionale moderno e veloce progettato specificamente per l'attività di Dermopigmentazione (PMU), Estetica e Trucco Spose, accessibile in tempo reale da computer e da iPhone (salvabile a schermo intero come app sulla schermata Home).

---

## Caratteristiche Principali

- **Accesso Rapido con PIN**: Sblocco immediato a 4 cifre (PIN predefinito: `1234`, modificabile nelle Impostazioni).
- **Agenda & Calendario Unificati**:
  - Vista mensile e lista cronologica con filtro per sede (*Beauty Cent*, *The Touch*, ecc.) e *Spose*.
  - **Due pulsanti dedicati per l'inserimento rapido**:
    - `+ Nuovo PMU`: per prime sedute, ritocchi annuali, sfumature e labbra.
    - `+ Nuova Sposa`: per matrimoni, con gestione data prova trucco, acconto e saldo.
  - **Integrazione Google Calendar con Spunta `[x]`**: se la casella è spuntata, l'evento viene sincronizzato automaticamente su Google Calendar con orario, indirizzo della sede e dettagli cliente.
  - **Promemoria Ritocco Automatico**: se imposti la *Data Ritocco* per una prima seduta, il gestionale blocca automaticamente lo slot in agenda per la seconda seduta.
- **Rubrica Clienti Intelligente**:
  - Suggerimenti e autocompletamento in tempo reale durante la digitazione.
  - Creazione rapida con solo il Nome (campi telefono, email e note opzionali).
  - Scheda cliente con storico completo di tutti i trattamenti passati, totale speso e appuntamenti in programma.
  - Tasti rapidi di chiamata e WhatsApp diretto.
- **Gestione Spese Semplificata**:
  - Tracciamento rapido per categoria (*Materiale*, *Corsi di Formazione*, *Marketing*, *Attrezzatura*).
  - Calcolo automatico delle spese mensili e annuali.
- **Riepilogo & "Obiettivo Range Rover"**:
  - Schede KPI: Fatturato annuo/mensile, Incassi da Matrimoni, Spese e Guadagno Netto Effettivo (Fatturato - Spese).
  - Target mensile (es. media 2.700 €/mese) con barra di avanzamento e percentuale di raggiungimento dell'obiettivo.
  - Tabella mensile comparativa con quadratura identica al tuo foglio Excel.
- **Dati Storici Migrati**:
  - Già precaricati oltre **1.260 appuntamenti**, **100 spose**, **576 clienti** in rubrica e **136 spese** dal file *Obiettivo Range Rover.xlsx*.

---

## 1. Avvio Rapido in Locale (PC)

1. Apri il terminale in questa cartella:
   ```powershell
   npm run dev
   ```
2. Apri il browser all'indirizzo:
   ```
   http://localhost:3000
   ```
3. Inserisci il PIN: `1234`.

---

## 2. Configurazione Database Cloud (Supabase) - Gratuito

Per sincronizzare i dati sul cloud e renderli accessibili in tempo reale sia da PC che da iPhone:

1. Vai su [supabase.com](https://supabase.com) e accedi (o crea un account gratuito in 1 minuto).
2. Clicca su **New Project**, assegna un nome (es. `gestionale-fede`) e una password per il database.
3. Nel menu a sinistra di Supabase, clicca su **SQL Editor** -> **New Query**.
4. Copia e incolla l'intero contenuto del file `scripts/supabase_schema.sql` e premi **Run** (creerà tutte le tabelle in 2 secondi).
5. Se desideri caricare anche tutti i dati storici sul cloud, apri un'altra query in SQL Editor, incolla il file `scripts/supabase_seed.sql` e premi **Run**.
6. Vai su **Project Settings** -> **API** e copia:
   - `Project URL`
   - `anon public key`
7. Incolla questi due valori direttamente nelle **Impostazioni** del gestionale (icona ingranaggio in alto a destra).

---

## 3. Deploy Online per iPhone (Vercel) - Gratuito

1. Crea un account gratuito su [vercel.com](https://vercel.com).
2. Collega questa cartella (o caricala su GitHub come repository privato).
3. Clicca su **Deploy**: in 1 minuto otterrai un indirizzo web sicuro (es. `https://gestionale-fede.vercel.app`).
4. Apri il link dal tuo iPhone con **Safari**.
5. Tocca il tasto **Condividi** (il quadrato con la freccia verso l'alto) e seleziona **Aggiungi alla schermata Home**.
6. Ora avrai l'icona dell'app sul tuo iPhone e si aprirà a schermo intero come una vera app nativa!

