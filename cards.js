app.factory('cards', ['orderByFilter', function($orderBy) {


    var cards = {

        cardsMatch: function (c1, c2, c3) {
            for (var i = 0; i < 4; ++i) {

                //// if all are equal
                //if (c1.card[i] === c2.card[i] && c1.card[i] === c3.card[i]) {
                //    // ok
                //
                //    // else if all are different
                //} else if (c1.card[i] !== c2.card[i] && c1.card[i] !== c3.card[i] && c2.card[i] !== c3.card[i]) {
                //    // ok
                //
                //    // else: WRONG
                //} else {
                //    return false;
                //}

                // MASTER FORMULA
                if ((c1.card[i] + c2.card[i] + c3.card[i]) % 3 !== 0) {
                    return false;
                }
            }
            return true;
        },

        getCards: function (mixed) {
            var bufferCards = [];
            var id = 0;

            for (var i = 0; i < 3; ++i) {
                for (var j = 0; j < 3; ++j) {
                    for (var k = 0; k < 3; ++k) {
                        for (var l = 0; l < 3; ++l) {
                            bufferCards.push({
                                card: [i, j, k, l],
                                used: 0,
                                selected: 0,
                                id: id++,
                                position: Math.random(),
                                hint: 0
                            });
                        }
                    }
                }
            }

            if (mixed) {
                bufferCards = $orderBy(bufferCards, 'position', false);
            }

            return bufferCards;

        }
    };

    return cards;
}]);