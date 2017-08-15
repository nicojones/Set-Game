var app = angular.module('setgame', ['ngCookies']);

app.controller('SetGameController', ['$scope', '$timeout', '$interval', '$cookies', 'cards', 'helper',
    function($scope, $timeout, $interval, $cookies, $cards, helper) {
        /**
         * Is there a game on?
         * @type {boolean}
         */
        $scope.gameOn = false;

        /**
         * Game stats to show at the end of the game
         * @type {{totalTime: number, totalSeconds: number, totalHintTime: number}}
         */
        $scope.gameStats = {
            totalTime: 0,
            totalSeconds: 0,
            totalHintTime: 0
        };

        /**
         * 12+ Cards being played
         * @type {Array}
         */
        $scope.cards = [];
        /**
         * Pile of cards to draw from
         * @type {Array}
         */
        $scope.pile  = [];

        /**
         * The selected cards that will be a set
         * @type {{a: card, b: card, c: card}}
         */
        $scope.selectedCards = {
            a: false,
            b: false,
            c: false
        };

        /**
         * By default, people can click on cards... except when they select the third.
         * @type {boolean}
         */
        var cardsClickable = true;

        /**
         * Completed sets
         * @type {Array}
         */
        $scope.sets = [];

        /**
         * Amount of time added because of hints, for the current set
         * @type {number}
         */
        $scope.hintTimeCurrent = 0;

        /**
         * Counter for the set IDs
         * @type {number}
         */
        var setID = 0;

        /**
         * Array with time values for each of the three possible hints
         * @type {number[]}
         */
        var hintTime = [10, 10, 10];

        /*
            TIMERS
         */
        /**
         * Number of seconds since game started
         * @type {number}
         */
        $scope.timeElapsedCounter = 0;

        /**
         * Human-readable time since game started
         * @type {string}
         */
        $scope.timeElapsed = '00:00';

        /**
         * Timestamp of last set completed
         * @type {number}
         */
        var previousTime = 0;

        /*
            MULTIPLAYER
         */
        /**
         * TRUE when two-player mode is enabled
         * @type {boolean}
         */
        $scope.twoPlayers = false;

        /**
         * The player that is currently selected (for the next x seconds). Can be 0 (nobody), 1 or 2
         * @type {number}
         */
        $scope.activePlayer = 0;

        /**
         * Number of seconds left in turn of player X
         * @type {number}
         */
        $scope.playerTimeout = 0;

        /**
         * Scoreboard for both players
         * @type {number[]}
         */
        $scope.playerPoints = [0, 0];

        /**
         * $interval object for the countdown
         */
        var activePlayerTimeout;

        /**
         * Letters corresponding to the shortcuts for the cards (QWERTY)
         * @type {string[]}
         */
        $scope.shortcuts = ['E', 'R', 'T', 'Y', 'U', 'D', 'F', 'G', 'H', 'J', 'C', 'V', 'B', 'N', 'M'];

        /**
         * Timeout to clear the alert message
         */
        var clearAlert;

        ///
        var deselectedCards;

        /**
         * Restart the game and start anew
         * @param manually If true it will ask for confirmation
         */
        $scope.restartGame = function(manually) {
            if (manually && !confirm('Restart game?')) {
                return;
            }
            // we generate the cards
            var deckCards = $cards.getCards(true);

            // take 12 cards for the game and keep the rest in the deck
            var pile = deckCards.splice(12);
            var hand = deckCards;

            // add it to the local $scope
            $scope.cards = hand;
            $scope.pile  = pile;
            // restart timers
            $scope.timeElapsedCounter = 0;
            $scope.timeElapsed = '00:00';

            // empty the list of sets from a potentially previous game
            $scope.sets = [];

            // ... and add a card if there's no possible sets on view
            while(!findMatchingSet()) {
                $scope.cards.push($scope.pile.pop());
            }

            // START!
            $scope.gameOn = true;
        };

        $scope.selectCard = function(card) {

            console.log(cardsClickable);
            if (!cardsClickable) {
                return;
            }

            // Only allow to select cards IF it's single player OR (it's multi-player and player is selected)
            if ($scope.twoPlayers && $scope.activePlayer == 0) {
                notify('message', "Select user!");
                return;
            }

            // if the card isn't selected
            if (!card.selected) {
                markAsSelected(card);

                var possibleSet = $scope.selectedCards;
                // if there are three selected cards and they match
                if ($scope.selectedCards.c) {
                    if ($cards.cardsMatch(possibleSet.a, possibleSet.b, possibleSet.c)) {
                        // we do this so nobody can mess things up

                        // we notify that they've selected a valid set!
                        notify('success');

                        deselectCards();
                        $timeout(function() {
                            // We save the sets, add points, save current time... and deselect the cards
                            saveNewSetAndRefresh();


                            // We set some of the scores and timers back to default
                            resetHintTime();

                            // is better to preserve the order of the cards. So: if there are only twelve
                            if ($scope.cards.length === 12) {
                                // we can replace those three cards by three new ones
                                for (var i = 0; i < $scope.cards.length; ++i) {
                                    if ($scope.cards[i].used == 1) {
                                        $scope.cards[i] = $scope.pile.pop();
                                    }
                                }
                            } else {
                                //refresh the whole table by keeping only the "unused" cards:
                                var cardsBuffer = $scope.cards,
                                    newCards = [];
                                for (var i = 0; i < cardsBuffer.length; ++i) {
                                    if (cardsBuffer[i].used == 0) {
                                        newCards.push(cardsBuffer[i]);
                                    }
                                }
                                // and refresh the $scope!
                                $scope.cards = newCards;
                            }

                            // add new cards until the table has twelve, as long as there are cards on the pile
                            while ($scope.pile.length && $scope.cards.length < 12) {
                                $scope.cards.push($scope.pile.pop());
                            }

                            // IF there's no cards left on the pile THEN remove 'undefined's:
                            if (!$scope.pile.length) {
                                var cardsOnTable = [];
                                for (var i = 0; i < $scope.cards.length; ++i) {
                                    if ($scope.cards[i] !== undefined) {
                                        cardsOnTable.push($scope.cards[i]);
                                    }
                                }
                                $scope.cards = cardsOnTable;
                            }

                            // add a card if there's no possible sets
                            while (!findMatchingSet()) {
                                console.log("cards left:", $scope.pile.length);
                                // if there are cards on the pile:
                                if ($scope.pile.length) {
                                    $scope.cards.push($scope.pile.pop());
                                } else {
                                    gameWon();

                                    return;
                                }
                            }


                            // people can select cards again!
                        }, 1000);

                    } else {
                        // red message
                        notify('wrong');

                        deselectCards();

                        if ($scope.twoPlayers) {
                            --$scope.playerPoints[$scope.activePlayer - 1];
                            deselectPlayer();
                        }
                    }
                }
            } else {
                // de-select
                markAsUnselected(card);
            }

        };

        $scope.hint = function(numberOfHints) {
            numberOfHints = numberOfHints || 2;
            findMatchingSet(function(i, j, k) {

                // we revert to showing only one hint
                $scope.cards[i].hint = 1;
                $scope.cards[j].hint = 0;
                $scope.cards[k].hint = 0;

                $scope.timeElapsedCounter += addHintTime(1);

                // and we show more if requested
                if (numberOfHints > 1) {
                    $scope.cards[j].hint = 1;
                    $scope.timeElapsedCounter += addHintTime(2);
                }
                if (numberOfHints > 2) {
                    $scope.cards[k].hint = 1;
                    $scope.timeElapsedCounter += addHintTime(3);
                }

            }, function() {
                notify('nothing');
                $scope.cards.push($scope.pile.pop());
            });
        };

        $scope.addCard = function() {
            findMatchingSet(function() {
                notify('message', "There's a set, find it!");
            }, function() {
                $scope.cards.push($scope.pile.pop());
            });
        };

        $scope.keyboardShortcut = function($event) {

            switch($event.keyCode) {
                case 49:
                    $scope.hint(1);
                    notify('message', 'This card is part of a set');
                    break;
                case 50:
                    $scope.hint(2);
                    notify('message', 'These two cards are part of a set');
                    break;
                case 51:
                    $scope.hint(3);
                    notify('message', 'This is a set');
                    break;

                case 53:
                    findMatchingSet(function(i,j,k) {
                        $scope.selectCard($scope.cards[i]);
                        $scope.selectCard($scope.cards[j]);
                        $scope.selectCard($scope.cards[k]);
                    });
                    break;

                case 66:
                    if ($scope.cards.length > 12) {
                        $scope.selectCard($scope.cards[12]);
                    }
                    break;
                case 67:
                    $scope.selectCard($scope.cards[10]);
                    break;
                case 68:
                    $scope.selectCard($scope.cards[5]);
                    break;
                case 69:
                    $scope.selectCard($scope.cards[0]);
                    break;
                case 70:
                    $scope.selectCard($scope.cards[6]);
                    break;
                case 71:
                    $scope.selectCard($scope.cards[7]);
                    break;
                case 72:
                    $scope.selectCard($scope.cards[8]);
                    break;
                case 74:
                    $scope.selectCard($scope.cards[9]);
                    break;
                case 77:
                    selectPlayer(2);
                    if ($scope.cards.length > 14) {
                        $scope.selectCard($scope.cards[14]);
                    }
                    break;
                case 78:
                    if ($scope.cards.length > 13) {
                        $scope.selectCard($scope.cards[13]);
                    }
                    break;
                case 82:
                    $scope.selectCard($scope.cards[1]);
                    break;
                case 84:
                    $scope.selectCard($scope.cards[2]);
                    break;
                case 85:
                    $scope.selectCard($scope.cards[4]);
                    break;
                case 86:
                    $scope.selectCard($scope.cards[11]);
                    break;
                case 89:
                    $scope.selectCard($scope.cards[3]);
                    break;

                //players:
                case 90:
                    selectPlayer(1);
                    break;
                default:
                    break;
            }
        };

        var findMatchingSet = function(found, notFound) {
            found = found || function(){};
            notFound = notFound || function(){};
            var cardsOnTable = $scope.cards.length;
            console.log($scope.cards);
            for (var i = 0; i < cardsOnTable; ++i) {
                for (var j = i + 1; j < cardsOnTable; ++j) {
                    var cardOne = $scope.cards[i].card;
                    var cardTwo = $scope.cards[j].card;

                    var cardThree = [
                        (6 - cardOne[0] - cardTwo[0]) % 3,
                        (6 - cardOne[1] - cardTwo[1]) % 3,
                        (6 - cardOne[2] - cardTwo[2]) % 3,
                        (6 - cardOne[3] - cardTwo[3]) % 3
                    ];
                    var cardThreeID = Math.pow(3, 3) * cardThree[0]
                        + Math.pow(3, 2) * cardThree[1]
                        + Math.pow(3, 1) * cardThree[2]
                        + Math.pow(3, 0) * cardThree[3];
                    for (var k = j + 1; k < cardsOnTable; ++k) {
                        if ($scope.cards[k] && $scope.cards[k].id === cardThreeID) {
                            found(i, j, k);
                            return true;
                        }
                    }
                }
            }
            notFound();
            return false;
        };

        var saveNewSetAndRefresh = function() {
            var s = $scope.selectedCards;
            // hide them:
            ++setID;

            $scope.selectedCards.a.used = 1;
            $scope.selectedCards.b.used = 1;
            $scope.selectedCards.c.used = 1;

            var points = 3 - (s.a.hint + s.b.hint + s.c.hint);

            $scope.sets.push({
                cards: [$scope.selectedCards.a, $scope.selectedCards.b, $scope.selectedCards.c],
                setID: setID,
                onHuman: $scope.timeElapsed,
                on: $scope.timeElapsedCounter,
                perSet: $scope.timeElapsedCounter - previousTime,
                hintTime: $scope.hintTimeCurrent,
                player: $scope.activePlayer,
                points: points
            });

            if ($scope.twoPlayers) {
                console.log($scope.playerPoints, $scope.activePlayer, $scope.activePlayer - 1, $scope.playerPoints[$scope.activePlayer - 1], points, $scope.playerPoints[$scope.activePlayer - 1] + points);
                $scope.playerPoints[$scope.activePlayer - 1] = $scope.playerPoints[$scope.activePlayer - 1] + points;

                deselectPlayer();
            }

            previousTime = $scope.timeElapsedCounter;
        };

        var deselectCards = function() {
            $timeout(function() {
                for (var i = 0; i < $scope.cards.length; ++i) {
                    $scope.cards[i].selected = 0;
                }
                $scope.selectedCards = {
                    a: false,
                    b: false,
                    c: false
                };
                cardsClickable = true;
            }, 1100);
            deselectedCards = true;
        };

        var markAsSelected = function(card) {
            if (!$scope.selectedCards.a) {
                $scope.selectedCards.a = card;
            } else if (!$scope.selectedCards.b) {
                $scope.selectedCards.b = card;
            } else if (!$scope.selectedCards.c) {
                $scope.selectedCards.c = card;
                // we have three cards selected, no more should be allowed!
                cardsClickable = false;
            } else {
                // false, all busy...
                console.error('already three cards?');
            }
            card.selected = 1;
        };

        var markAsUnselected = function(card) {
            var reselectCards = [];
            if ($scope.selectedCards.a !== card) {
                reselectCards.push($scope.selectedCards.a)
            }
            if ($scope.selectedCards.b !== card) {
                reselectCards.push($scope.selectedCards.b)
            }
            if ($scope.selectedCards.c !== card) {
                reselectCards.push($scope.selectedCards.c)
            }

            $scope.selectedCards = {
                a: reselectCards[0],
                b: reselectCards[1]
            };

            card.selected = 0;
        };

        var notify = function(messageType, message) {
            switch (messageType) {
                case 'success':
                    $scope.alert = 'Great!';
                    break;
                case 'wrong':
                    $scope.alert = 'Not a valid set';
                    break;
                case 'nothing':
                    $scope.alert = 'There are no matching pairs';
                    break;
                case 'message':
                    $scope.alert = message;
                    break;
                default:
                    break;
            }
            $timeout.cancel(clearAlert);
            clearAlert = $timeout(function() {
                $scope.alert = '';
            }, 2000);
        };

        var addHintTime = function(hinted) {
            var hintTimeToAdd = hintTime[hinted - 1];
            hintTime[hinted - 1] = 0;
            $scope.hintTimeCurrent += hintTimeToAdd;
            $scope.gameStats.totalHintTime += hintTimeToAdd;
            return hintTimeToAdd;
        };

        var resetHintTime = function() {
            hintTime = [10, 10, 10];
            $scope.hintTimeCurrent = 0;
        };

        var selectPlayer = function(playerID) {
            if (!$scope.twoPlayers) {
                return false;
            }
            if ($scope.playerTimeout) {
                return false;
            }
            // all well, we can select the player:
            $scope.activePlayer = playerID;
            $scope.playerTimeout = 5;
            activePlayerTimeout = $interval(function() {
                --$scope.playerTimeout;
                if ($scope.playerTimeout <= 0) {
                    $interval.cancel(activePlayerTimeout);
                    --$scope.playerPoints[$scope.activePlayer - 1];
                    $scope.activePlayer = 0;
                }
            }, 1000);

        };
        
        var deselectPlayer = function() {
            $scope.activePlayer = 0;
            $scope.playerTimeout = 0;
            $interval.cancel(activePlayerTimeout);
        };

        /**
         * When the user wins the game 
         */
        var gameWon = function() {
            // you've won the game!
            $scope.gameStats.totalTime = $scope.timeElapsed;
            $scope.gameStats.totalTimeSeconds = $scope.timeElapsedCounter;

            $scope.gameFinishedModal = true;
            $scope.gameOn = false;

            if ($scope.twoPlayers) {
                $scope.playerWon = $scope.playerPoints[0] > $scope.playerPoints[1] ? '1' : '2';
            }

        }

        $interval(function() {
            if ($scope.showSets) {
                // if the modal is open we pause the timer
                return;
            }
            if (deselectedCards) {
                deselectedCards = false;
            } else {
                ++$scope.timeElapsedCounter;
            }
            $scope.timeElapsed = helper.addZero(Math.floor($scope.timeElapsedCounter / 60)) + ':' + helper.addZero($scope.timeElapsedCounter % 60)
        }, 1000);

    }]);