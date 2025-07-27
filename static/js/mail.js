(function (global, $) {

  const MY_MAIL = 'astroweb86@gmail.com';

  const TEMPLATE = `Bonjour à toute l'équipe,

Je me présente, je suis Théo, fondateur d’Astroweb Digital, une petite agence web basée à Poitiers. J’ai eu l’occasion de découvrir %NAME% et je suis sincèrement touché par l’engagement que vous manifestez au quotidien pour l’accessibilité et l’entraide dans votre communauté.

Votre action sur le terrain est essentielle et mérite d’être mise en lumière. C’est pourquoi je vous propose de créer gratuitement un site vitrine pour votre association. Ce geste est pour moi une manière de soutenir votre mission admirable.

Il n’y a aucune contrepartie ou engagement demandé ; seuls les frais d’hébergement resteraient à votre charge et je peux vous aider à les minimiser.

J’espère que cette proposition retiendra votre attention. Je suis disponible pour en parler quand cela vous conviendra.

Merci pour tout ce que vous faites ; j’ai hâte de contribuer à votre cause.

Bien cordialement,

Théo  
AstroWeb Digital  
astroweb86@gmail.com`;

  /* construit le mailto complet */
  function buildMailto(to, sub, body) {
    return 'mailto:' + encodeURIComponent(to) +
           '?cc=' + encodeURIComponent(MY_MAIL) +
           '&subject=' + encodeURIComponent(sub) +
           '&body=' + encodeURIComponent(body);
  }

  global.attachMail = function (dt) {

    $('#assos-table tbody').off('.mail')
      .on('click.mail', '.btn-mail', function () {

        const data = dt.row($(this).closest('tr')).data();
        if (!data) return;

        const to = (data.mail || '').replace(/^mailto:/i, '');
        const name = data.title;

        $('#mailAssoName').text(name);
        $('#mailTo').text(to || '—');

        const subj = `Proposition de site vitrine pour ${name}`;
        const body = TEMPLATE.replace(/%NAME%/g, name);

        $('#mailSubject').val(subj);
        $('#mailBody').val(body);

        $('#mailtoLink').attr('href', buildMailto(to, subj, body));

        $('#mailModal').modal('show');
      });

    /* maj du lien si on édite sujet / corps */
    $('#mailSubject, #mailBody').off('.upd').on('input.upd', function () {
      const to   = $('#mailTo').text();
      const subj = $('#mailSubject').val();
      const body = $('#mailBody').val();
      $('#mailtoLink').attr('href', buildMailto(to, subj, body));
    });
  };

})(window, jQuery);
