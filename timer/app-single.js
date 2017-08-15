var app = angular.module('countdown', ['ngCookies', 'mousewheel']);

app.controller('CountdownController', ['$scope', '$timeout', '$interval', '$cookies',
    function($scope, $timeout, $interval, $cookies) {
        /**
         * Timer is running?
         * @type {boolean}
         */
        $scope.timerRunning = false;

        /**
         * State of the timer. -1 (paused), 0 (off), 1 (running)
         * @type {number}
         */
        $scope.timerState = 0;

        /**
         * Seconds until timer ends
         * @type {number}
         */
        $scope.countdownEnd = 0;

        /**
         * UNIX timestamp of when timer ends
         * @type {number}
         */
        var hashTime = 0;
        /**
         * Now set to 1000 milliseconds
         * @type {number}
         */
        var intervalLoop = 0;
        /**
         * Units for the timer
         * @type {*[]}
         */
        var units = [['second', 'seconds'], ['minute', 'minutes'], ['hour', 'hours'], ['day', 'days']];

        /**
         * Presets to start the timer
         * @type {{days: number, hours: number, minutes: number, seconds: number}}
         */
        var countdownValueDefault = {days: 0, hours: 0, minutes: 0, seconds: 0};
        $scope.countdownValue     = angular.copy(countdownValueDefault);
        $scope.countdownOriginal  = angular.copy(countdownValueDefault);

        /**
         * Values of the units
         * @type {number}
         */
        $scope.seconds = 0;
        $scope.minutes = 0;
        $scope.hours   = 0;
        $scope.days    = 0;

        /**
         * Restores the timer to a previous session
         */
        $scope.restoreTimer = function() {
            var hash = window.location.hash,
                matchPaused = hash.length ? (hash.match(/\/?t=([0-9]+)/)   || []) : [],
                matchTimer  = hash.length ? (hash.match(/\/?end=([0-9]+)/) || []) : [];

            // if the timer is paused, restore the numbers:
            if ($cookies.get('paused') || matchPaused.length) {
                // set the countdown time:

                if (matchPaused.length) {
                    $scope.countdownEnd = matchPaused[1] - 0; // to get a nice _int_
                } else {
                    $scope.countdownEnd = $cookies.get('paused') - 0;
                }

                computeCountdownTime($scope.countdownEnd);

            // If there's a #end=12345, it takes precedence
            } else if (matchTimer.length) {
                // matches a pattern, so we get the UNIX timestamp
                hashTime = matchTimer[1] - 0; // to get a nice _int_

                var futureTime = hashTime - now();

                // we calculate the future time:
                $scope.countdownEnd = hashTime;
                if (futureTime > 0) { // e.g. if it's in the future
                    $timeout(function() {
                        $scope.startTimer(futureTime)
                    }, 300);
                } else {
                    // nothing. the timer has ended
                }

            } else if ($cookies.get('timer')) {
                // There's a cookie saying there's a timer.
                // TODO multiple timers, or at least allowing the user to select between timers

                // When is the timer due?
                hashTime = ($cookies.get('timer') - 0);
                var futureTime = hashTime - now();

                // Convert seconds to a nice days/hours/minutes/seconds
                if (computeCountdownTime(futureTime)) {
                    // and start the timer
                    $scope.timerRunning = true;
                    timerStart();
                } else {
                    // nothing. the timer has ended
                }
            }

            // If it's an invalid hash:
            if (matchPaused.length + matchTimer.length == 0) {
                window.location.hash = '';
            }

        };

        /**
         * Starts the timer
         */
        $scope.startTimer = function (countdownSeconds) {
            countdownSeconds = countdownSeconds || 0;
            if (!countdownSeconds) {
                // not a valid time:

                // we can display a message:
                $scope.alert = "Time must be more than 0 seconds... obviously!";

                // and exit
                return false;
            }

            // it's >= 0, so this function will return true
            computeCountdownTime(countdownSeconds);

            // expiry time:
            hashTime = now() + countdownSeconds;

            // we start the timer
            timerStart();

            // Put a cookie that expires at the due time
            $cookies.put('timer', hashTime + "", {expires: (new Date(hashTime * 1000))});
            // removed the 'paused' cookie, if exists
            $cookies.remove('paused');

            // if ShareableURL is ON, we update it:
            if (!!$scope.shareURL) {
                window.location.hash = 'end=' + hashTime;
            }
        };

        /**
         * Stop the timer
         */
        $scope.stopTimer = function (){
            timerStop();
        };

        /**
         * Reset the timer and delete the #end=12345 hash
         */
        $scope.resetTimer = function() {
            if (!confirm("Are you sure?")) {
                return false;
            }
            // else
            timerStop();

            window.location.hash = '';
        };

        $scope.pauseTimer = function() {
            if ($scope.timerRunning) {
                // we pause it:
                //$scope.countdownEnd = hashTime - now(); // Time until timer finishes, in seconds

                // timer is not running...
                $scope.timerRunning = false;
                // but it's paused:
                $scope.timerState = -1;

                // set a cookie/hash that says when did we pause:
                $cookies.put('paused', $scope.countdownEnd);
                console.log('url', $scope.shareURL);
                if (!!$scope.shareURL) {
                    window.location.hash = 't=' + ($scope.countdownEnd + "");
                }

                // Remove the cookie that says when it's over:
                $cookies.remove('timer');

                // we're only pausing, so all units stay the same. We only need to stop the loop:
                $interval.cancel(intervalLoop);
            } else {
                // we resume the timer:
                $scope.timerRunning = true;
                // and thus,
                $scope.timerState = 1;

                // Remove the cookie that says we're paused:
                $cookies.remove('paused');

                // When does it end?
                hashTime = now() + $scope.countdownEnd;

                // Add the cookies to track the time:
                $cookies.put('timer', hashTime + "", {expires: (new Date(hashTime * 1000))});
                // and hash, if required
                if (!!$scope.shareURL) {
                    window.location.hash = 'end=' + hashTime;
                }

                // start the timer
                timerStart();
            }
        };

        // FORMS //
        //$scope.setDueDate = function(form) {
        //    $scope.countdownEnd = (new Date()).setMilliseconds(0);
        //
        //    $scope.startTimer();
        //};

        /**
         * One of the forms to set the countdown time
         * @param form
         */
        $scope.setCountdown = function(form) {

            // TODO we need to figure out if they set the timer by typing on the numbers or by setting the dials, or...

            // reset the inputs, all to zero!
            $scope.countdownValue = countdownValueDefault;

            // we start
            $scope.startTimer($scope.countdownEnd - 0);
        };

        /**
         * Show or hide the #end=12345 hash on the URL.
         */
        $scope.showShareURL = function() {
            if (!!$scope.shareURL) {
                if ($cookies.get('paused')) {
                    window.location.hash = 't=' + $cookies.get('paused');
                } else {
                    window.location.hash = 'end=' + hashTime;
                }
            } else {
                window.location.hash = '';
            }
        };

        $scope.countdownInputSet = function(type, $deltaY, absolute) {
            absolute = absolute || false;

            console.log(($deltaY > 0 ? '+' : '') + $deltaY + ' ' + type, absolute);
            //console.log($scope.countdownEnd);

            switch(type) {
                case 'seconds':
                    $scope.countdownEnd += (absolute ? absolute - $scope.countdownValue.seconds : $deltaY);
                    break;
                case 'minutes':
                    $scope.countdownEnd += (absolute ? absolute - $scope.countdownValue.minutes : 15 * $deltaY);
                    break;
                case 'hours':
                    $scope.countdownEnd += (absolute ? absolute - $scope.countdownValue.hours   : 900 * $deltaY);
                    break;
                case 'days':
                    $scope.countdownEnd += (absolute ? absolute - $scope.countdownValue.days    : (86400/4) * $deltaY);
                    break;
            }

            if ($scope.countdownEnd <= 0) {
                $scope.countdownValue = countdownValueDefault;
                return;
            }

            // else:
            var countdownInputSeconds = $scope.countdownEnd;

            $scope.countdownValue.days    = Math.floor(countdownInputSeconds / 86400);
            countdownInputSeconds -= $scope.countdownValue.days * 86400;

            $scope.countdownValue.hours   = Math.floor(countdownInputSeconds / 3600);
            countdownInputSeconds -= $scope.countdownValue.hours * 3600;

            $scope.countdownValue.minutes = Math.floor(countdownInputSeconds / 60);
            countdownInputSeconds -= $scope.countdownValue.minutes * 60;

            $scope.countdownValue.seconds = countdownInputSeconds;

        };

        /**
         * Starts the timer
         * @param interval The refresh interval. Defaults to 1000 = 1second
         */
        var timerStart = function(interval) {
            interval = interval || 1000;

            // cancel before starting!
            $interval.cancel(intervalLoop);

            $scope.timerState   = 1;
            $scope.timerRunning = true;

            // We start the loop
            intervalLoop = $interval(function() {
                // one second less
                --$scope.seconds;
                --$scope.countdownEnd;

                // if we went past 0seconds, we need to change other units
                if ($scope.seconds == -1) {
                    tickClock();
                }

                // Refresh the UNITS, i.e. second/seconds
                setTimerUnits();
            }, interval);
        };

        /**
         * Stops the timer, resets everything to 0, removes the cookie
         */
        var timerStop = function() {
            $interval.cancel(intervalLoop);

            // set all to 0
            $scope.days    = 0;
            $scope.hours   = 0;
            $scope.minutes = 0;
            $scope.seconds = 0;

            // and adjust the units
            setTimerUnits();

            $scope.timerState = 0;

            // TODO why?
            $scope.countdownEnd = 0;

            // removes the timer cookie
            $cookies.remove('timer');
            $cookies.remove('paused');
        };

        /**
         * Manages what happens when the seconds reach 0
         */
        var tickClock = function() {
            // if hours and minutes is 0, either we're done or we need to substract a day
            if ($scope.hours == 0 && $scope.minutes == 0) {
                // if days is 0, we're done!
                if ($scope.days == 0) {
                    timerDone();
                    return;
                } else {
                    // else, we're in XX:23:59:59
                    $scope.days = $scope.days - 1;
                    $scope.hours = 23;
                    $scope.minutes = 59;
                }
            // we know hours != 0 (previous case), so we substract an hour and continue
            } else if ($scope.minutes == 0) {
                // we know hours != 0
                $scope.hours = $scope.hours - 1;
                $scope.minutes = 59;
            // We know minutes != 0
            } else {
                $scope.minutes = $scope.minutes - 1;
            }
            // and we restart the modulo 60 second count.
            $scope.seconds = 59;
        };

        /**
         * Converts a difference of seconds into Days, Hours, Minutes, Seconds
         * @param difference The seconds to convert
         * @returns {boolean} TRUE if all well, FALSE if difference is negative and hence the timer should be done
         */
        var computeCountdownTime = function(difference) {
            console.log(difference)
            if ((difference - 0) <= 0 || isNaN(difference)) {
                timerNegative(difference);
                return false;
            }

            $scope.countdownEnd = difference; // positive, and number of seconds

            $scope.days    = Math.floor(difference / 86400);
            difference -= $scope.days * 86400;

            $scope.hours   = Math.floor(difference / 3600);
            difference -= $scope.hours * 3600;

            $scope.minutes = Math.floor(difference / 60);
            difference -= $scope.minutes * 60;

            $scope.seconds = difference;

            // and we set the value for the original / unchanging global scope:
            $scope.countdownOriginal = {
                days:     $scope.days,
                hours:    $scope.hours,
                $minutes: $scope.minutes,
                $seconds: $scope.seconds
            };

            return true;
        };

        /**
         * Provisional alert for when the timer is done
         * @param secondsAgo
         */
        var timerNegative = function(secondsAgo) {
            // TODO we want a different alert
            $scope.alert = "The timer ended " + Math.abs(secondsAgo) + " seconds ago";
        };

        /**
         * When the timer is done, we set all to 0, cancel the timer, remove the cookie
         */
        var timerDone = function() {
            $scope.seconds = 0;
            $interval.cancel(intervalLoop);
            $cookies.remove('timer');
            // TODO we want a different alert
            $scope.alert = "Timer done!";
        };

        /**
         * Sets the units of the countdown, e.g. Day(s)
         */
        var setTimerUnits = function() {
            $scope.daysS    = ($scope.days    == 1 ? units[3][0] : units[3][1]);
            $scope.hoursS   = ($scope.hours   == 1 ? units[2][0] : units[2][1]);
            $scope.minutesS = ($scope.minutes == 1 ? units[1][0] : units[1][1]);
            $scope.secondsS = ($scope.seconds == 1 ? units[0][0] : units[0][1]);
        };

        /**
         * Returns a timestamp, either with or without milliseconds, with .000 milliseconds
         * @param milliseconds
         * @returns {number}
         */
        var now = function(milliseconds) {
            milliseconds = milliseconds || false;
            var moment = (new Date()).setMilliseconds(0);

            return milliseconds ? moment : Math.floor(moment / 1000);
        };

        // Initialising
        setTimerUnits();

    }]);