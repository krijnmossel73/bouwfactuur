import LegalPage from './LegalPage.jsx';
import { OPERATOR, LEGAL_UPDATED } from './legal.js';

export default function Privacy({ onBack, loggedIn }) {
  const O = OPERATOR;
  return (
    <LegalPage title="Privacyverklaring" updated={LEGAL_UPDATED} onBack={onBack} loggedIn={loggedIn}>
      <p>
        BouwFactuur ({O.site}) is een dienst van {O.name} ({O.legalForm}), KvK {O.kvk}, {O.address}, {O.postalCity}.
        Vragen over privacy: <a href={`mailto:${O.email}`}>{O.email}</a>. Deze verklaring beschrijft welke persoonsgegevens
        wij verwerken, waarom, hoe lang, en welke rechten u heeft onder de Algemene verordening gegevensbescherming (AVG).
      </p>

      <h2>1. Twee rollen: verwerkingsverantwoordelijke en verwerker</h2>
      <p>
        Voor de gegevens van <strong>uw account</strong> (e-mailadres, bedrijfsprofiel, abonnement) zijn wij
        verwerkingsverantwoordelijke. Voor de gegevens die u <strong>zelf invoert over anderen</strong>, zoals
        contactgegevens van opdrachtgevers en de inhoud van uw facturen, bent u verwerkingsverantwoordelijke en zijn wij
        verwerker: wij verwerken die gegevens uitsluitend om de dienst aan u te leveren. Artikel 9 van de algemene voorwaarden
        bevat de afspraken die daarvoor als verwerkersovereenkomst gelden.
      </p>

      <h2>2. Welke gegevens wij verwerken</h2>
      <ul>
        <li><strong>Accountgegevens:</strong> e-mailadres, wachtwoord (versleuteld opgeslagen door onze inlogprovider) of uw Google-account-ID als u met Google inlogt, tijdstip van aanmelden en inloggen.</li>
        <li><strong>Bedrijfsprofiel:</strong> bedrijfsnaam, adres, KvK-nummer, BTW-nummer, IBAN en G-rekening, vakgebied.</li>
        <li><strong>Opdrachtgevers en facturen:</strong> de bedrijfs- en contactgegevens van uw opdrachtgevers en de inhoud van de facturen die u opslaat, inclusief de verzendstatus via Peppol.</li>
        <li><strong>Abonnement en betaling:</strong> uw Stripe-klantnummer, abonnementsstatus en factuurteller. Betaalgegevens (kaart, IBAN) worden alleen door Stripe verwerkt; wij zien of bewaren die niet.</li>
        <li><strong>Technische gegevens:</strong> IP-adres, browsertype en tijdstip van verzoeken in de serverlogboeken van Cloudflare, voor beveiliging en foutopsporing. Wij gebruiken geen tracking-cookies en geen advertentienetwerken.</li>
      </ul>

      <h2>3. Waarvoor en op welke grondslag</h2>
      <ul>
        <li><strong>Leveren van de dienst</strong> (account, opslag, PDF, e-factuur, Peppol-verzending): uitvoering van de overeenkomst (art. 6 lid 1 sub b AVG).</li>
        <li><strong>Betaling en administratie</strong> van Pro-abonnementen: uitvoering van de overeenkomst en wettelijke bewaarplicht (art. 6 lid 1 sub c AVG).</li>
        <li><strong>Beveiliging, misbruikpreventie en foutopsporing:</strong> gerechtvaardigd belang (art. 6 lid 1 sub f AVG).</li>
        <li><strong>Servicemails</strong> over uw account of belangrijke wijzigingen: uitvoering van de overeenkomst. Wij sturen geen marketingmail zonder uw toestemming.</li>
      </ul>

      <h2>4. Ontvangers en subverwerkers</h2>
      <p>Wij schakelen de volgende partijen in. Met elk van hen bestaat een verwerkersovereenkomst of gelden diens standaardvoorwaarden voor gegevensverwerking.</p>
      <ul>
        <li><strong>Cloudflare, Inc.</strong> (hosting, serverfuncties en database D1): opslag van uw profiel, opdrachtgevers en facturen; logboeken. Cloudflare verwerkt gegevens in de EU en de VS onder het EU-VS Data Privacy Framework en standaardcontractbepalingen.</li>
        <li><strong>Supabase, Inc.</strong> (inloggen en accountbeheer): e-mailadres en wachtwoord-hash, sessies.</li>
        <li><strong>Stripe Payments Europe, Ltd.</strong> (betalingen en abonnementen): naam, e-mailadres, betaalgegevens, betaalhistorie.</li>
        <li><strong>B2Brouter Global, S.L.</strong> (Peppol Access Point): de inhoud van een factuur die u via Peppol verzendt, inclusief de gegevens van de ontvanger, uitsluitend op uw verzoek per factuur.</li>
        <li><strong>Kamer van Koophandel</strong> (KvK Zoeken API) en <strong>Europese Commissie</strong> (VIES): het KvK- of BTW-nummer dat u opzoekt of valideert.</li>
        <li><strong>Google LLC</strong> (Google Fonts, en Google-login als u daarvoor kiest): bij het laden van lettertypen ziet Google uw IP-adres.</li>
      </ul>
      <p>Wij verkopen geen gegevens en delen ze niet met derden voor hun eigen doeleinden. Wij verstrekken gegevens alleen aan overheidsinstanties als de wet ons daartoe verplicht.</p>

      <h2>5. Bewaartermijnen</h2>
      <ul>
        <li>Account, profiel, opdrachtgevers en facturen: zolang uw account bestaat. Facturen die u in de app verwijdert, blijven gemarkeerd als verwijderd bewaard zodat het factuurnummer niet opnieuw kan worden uitgegeven; ze worden definitief gewist bij verwijdering van uw account.</li>
        <li>Na verwijdering van uw account wissen wij uw gegevens direct uit onze database; back-ups van de database worden binnen 30 dagen overschreven.</li>
        <li>Betaalgegevens en facturen van uw Pro-abonnement: 7 jaar (fiscale bewaarplicht), bij Stripe en in onze administratie.</li>
        <li>Serverlogboeken: maximaal 30 dagen.</li>
      </ul>
      <p><strong>Let op:</strong> u bent zelf verantwoordelijk voor de wettelijke bewaarplicht van 7 jaar voor uw eigen facturen. Download een backup voordat u facturen of uw account verwijdert.</p>

      <h2>6. Beveiliging</h2>
      <p>
        Alle verbindingen zijn versleuteld (TLS). Gegevens worden per account gescheiden opgeslagen en zijn alleen bereikbaar
        met een geldige inlogsessie. Wachtwoorden worden nooit leesbaar opgeslagen. Sleutels van externe diensten staan
        uitsluitend op de server en worden nooit naar uw browser gestuurd.
      </p>

      <h2>7. Uw rechten</h2>
      <p>U heeft het recht op inzage, rectificatie, verwijdering, beperking, overdraagbaarheid en bezwaar. In de app kunt u:</p>
      <ul>
        <li>al uw gegevens downloaden als JSON-bestand (Factuurhistorie → Backup downloaden): dit is uw recht op inzage en overdraagbaarheid;</li>
        <li>uw profiel en opdrachtgevers zelf aanpassen;</li>
        <li>uw account en alle bijbehorende gegevens verwijderen (Factuurhistorie → Account verwijderen). Een lopend Pro-abonnement wordt daarbij beëindigd.</li>
      </ul>
      <p>
        Voor andere verzoeken mailt u naar <a href={`mailto:${O.email}`}>{O.email}</a>; wij reageren binnen een maand. U heeft ook het
        recht een klacht in te dienen bij de Autoriteit Persoonsgegevens (autoriteitpersoonsgegevens.nl).
      </p>

      <h2>8. Cookies en lokale opslag</h2>
      <p>
        BouwFactuur gebruikt alleen functionele opslag in uw browser: de inlogsessie van Supabase. Er worden geen analytische
        of advertentiecookies geplaatst, en daarom wordt geen cookiebanner getoond.
      </p>

      <h2>9. Wijzigingen</h2>
      <p>
        Wij kunnen deze verklaring aanpassen, bijvoorbeeld bij een nieuwe subverwerker. Bij een wezenlijke wijziging
        informeren wij u per e-mail of in de app. De datum bovenaan geeft de actuele versie aan.
      </p>
    </LegalPage>
  );
}
