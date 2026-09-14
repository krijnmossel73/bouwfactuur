import LegalPage from './LegalPage.jsx';
import { OPERATOR, LEGAL_UPDATED } from './legal.js';

export default function Voorwaarden({ onBack, loggedIn }) {
  const O = OPERATOR;
  return (
    <LegalPage title="Algemene voorwaarden" updated={LEGAL_UPDATED} onBack={onBack} loggedIn={loggedIn}>
      <p>
        Deze voorwaarden gelden voor het gebruik van BouwFactuur ({O.site}), aangeboden door {O.name} ({O.legalForm}),
        KvK {O.kvk}, BTW {O.btw}, {O.address}, {O.postalCity}, e-mail <a href={`mailto:${O.email}`}>{O.email}</a> ("wij").
        Door een account aan te maken gaat u ("gebruiker") akkoord met deze voorwaarden.
      </p>

      <h2>1. De dienst</h2>
      <p>
        BouwFactuur is een online hulpmiddel waarmee ondernemers in de bouw facturen opstellen, controleren, exporteren (PDF en
        UBL/NLCIUS) en desgewenst via het Peppol-netwerk verzenden. De dienst is bedoeld voor zakelijk gebruik door
        ondernemers (B2B), niet voor consumenten.
      </p>

      <h2>2. Account</h2>
      <p>
        U bent verantwoordelijk voor de juistheid van uw gegevens en voor het geheimhouden van uw inloggegevens. Alles wat
        via uw account gebeurt, komt voor uw rekening. Meld misbruik direct bij ons. Wij kunnen een account blokkeren of
        beëindigen bij misbruik, fraude, wanbetaling of gebruik in strijd met de wet.
      </p>

      <h2>3. Gratis gebruik en Pro-abonnement</h2>
      <ul>
        <li>Zonder abonnement kunt u een beperkt aantal facturen opslaan (het actuele aantal staat in de app). PDF- en XML-export van een ingevulde factuur blijven beschikbaar.</li>
        <li>Met BouwFactuur Pro is het aantal facturen onbeperkt. De actuele prijs staat in de app; prijzen zijn exclusief BTW.</li>
        <li>Het abonnement loopt per maand en wordt automatisch verlengd totdat u het opzegt. Opzeggen kan op elk moment via het accountportaal (Factuurhistorie → Abonnement beheren) en gaat in aan het einde van de lopende maand. Er vindt geen restitutie plaats over de lopende periode.</li>
        <li>Betaling verloopt via Stripe. Bij een mislukte betaling behouden wij het recht Pro-functies te beperken totdat de betaling is voldaan.</li>
        <li>Wij mogen prijzen wijzigen; een wijziging geldt op zijn vroegst 30 dagen na aankondiging per e-mail of in de app. U kunt tot die datum opzeggen.</li>
      </ul>

      <h2>4. Uw verantwoordelijkheid voor de facturen</h2>
      <p>
        BouwFactuur helpt u met de opmaak, berekeningen en een controle op de gebruikelijke factuurvereisten (Belastingdienst,
        BTW-verleggingsregeling, G-rekening, Wet ketenaansprakelijkheid). Die controle is een hulpmiddel en geen garantie.
        <strong> U blijft zelf verantwoordelijk</strong> voor de juistheid en volledigheid van elke factuur, voor de toepassing
        van het juiste BTW-regime, voor uw administratie en bewaarplicht (7 jaar) en voor afdrachten aan de Belastingdienst.
        BouwFactuur geeft geen fiscaal, juridisch of boekhoudkundig advies; raadpleeg bij twijfel uw boekhouder of adviseur.
      </p>

      <h2>5. Peppol en externe diensten</h2>
      <p>
        Verzending via Peppol verloopt via een Access Point (B2Brouter). Verzending vindt alleen plaats op uw uitdrukkelijke
        opdracht per factuur. Of een ontvanger bereikbaar is en of een factuur wordt geaccepteerd, is afhankelijk van de
        ontvanger en het Peppol-netwerk; wij garanderen geen aflevering. KvK-gegevens en BTW-validatie (VIES) komen van
        externe bronnen; wij staan niet in voor de juistheid daarvan.
      </p>

      <h2>6. Beschikbaarheid en wijzigingen</h2>
      <p>
        Wij streven naar een goed werkende en beschikbare dienst, maar garanderen geen ononderbroken beschikbaarheid. Wij
        mogen de dienst aanpassen, uitbreiden of functies laten vervallen. Wezenlijke beperkingen kondigen wij vooraf aan.
        Onderhoud plannen wij zoveel mogelijk buiten kantooruren.
      </p>

      <h2>7. Uw gegevens en back-ups</h2>
      <p>
        Uw gegevens blijven van u. U kunt ze op elk moment als JSON-bestand downloaden. Wij maken back-ups van de database,
        maar u bent zelf verantwoordelijk voor het bewaren van kopieën van uw facturen conform de wettelijke bewaarplicht.
        Bij beëindiging van uw account worden uw gegevens verwijderd zoals beschreven in de privacyverklaring.
      </p>

      <h2>8. Aansprakelijkheid</h2>
      <p>
        Wij zijn niet aansprakelijk voor indirecte schade, gevolgschade, gederfde winst, gemiste besparingen, boetes of
        naheffingen van de Belastingdienst, of schade door verlies van gegevens waarvan u geen back-up heeft gemaakt. Onze
        totale aansprakelijkheid per gebeurtenis (een reeks samenhangende gebeurtenissen geldt als één) is beperkt tot het
        bedrag dat u in de twaalf maanden voorafgaand aan de gebeurtenis aan ons heeft betaald, met een maximum van € 250.
        Deze beperkingen gelden niet bij opzet of bewuste roekeloosheid van onze kant.
      </p>

      <h2>9. Verwerking van persoonsgegevens (verwerkersovereenkomst)</h2>
      <p>
        Voor de gegevens die u over uw opdrachtgevers invoert, bent u verwerkingsverantwoordelijke en zijn wij verwerker in
        de zin van de AVG. In dat kader geldt: (a) wij verwerken die gegevens uitsluitend om de dienst aan u te leveren en
        volgens uw instructies via de app; (b) wij nemen passende technische en organisatorische beveiligingsmaatregelen;
        (c) wij schakelen alleen de subverwerkers in die in de privacyverklaring staan en informeren u bij wijziging daarvan,
        waarna u binnen 30 dagen kunt opzeggen; (d) wij houden de gegevens vertrouwelijk; (e) wij helpen u redelijkerwijs bij
        verzoeken van betrokkenen en bij een datalek melden wij dat zonder onredelijke vertraging aan u; (f) na beëindiging
        verwijderen wij de gegevens, tenzij een wettelijke bewaarplicht geldt. De privacyverklaring beschrijft de verwerkingen
        in detail en maakt deel uit van deze voorwaarden.
      </p>

      <h2>10. Intellectuele eigendom</h2>
      <p>
        Alle rechten op BouwFactuur (software, vormgeving, teksten) berusten bij ons. U krijgt een niet-exclusief,
        niet-overdraagbaar gebruiksrecht voor de duur van uw account. De facturen en gegevens die u maakt, zijn van u.
      </p>

      <h2>11. Beëindiging</h2>
      <p>
        U kunt uw account op elk moment verwijderen via de app; een lopend Pro-abonnement eindigt dan direct zonder restitutie.
        Wij mogen de overeenkomst opzeggen met een termijn van 30 dagen, of direct bij schending van deze voorwaarden.
      </p>

      <h2>12. Overig</h2>
      <p>
        Wij mogen deze voorwaarden wijzigen; wijzigingen gelden 30 dagen na aankondiging. Op de overeenkomst is Nederlands
        recht van toepassing. Geschillen worden voorgelegd aan de bevoegde rechter in het arrondissement waarin wij gevestigd
        zijn, tenzij de wet dwingend anders bepaalt. Als een bepaling nietig is, blijven de overige bepalingen van kracht.
      </p>
    </LegalPage>
  );
}
