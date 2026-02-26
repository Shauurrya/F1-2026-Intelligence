window.NewsVerificationEngine = {
    processNews: function (newsItems) {
        let verifiedSignals = [];
        newsItems.forEach(item => {
            let confirmed = item.text.match(/(confirmed upgrade|fia ruling|official penalty|technical directive)/i);
            let opinion = item.text.match(/(looks fast|speculation|opinion|might|could)/i);

            if (confirmed && !opinion && item.sources >= 2) {
                verifiedSignals.push(item);
            }
        });
        return verifiedSignals;
    }
};
