var app = angular.module('countdown', ['timer', 'ngCookies']);

app.config(['$locationProvider',
    function($locationProvider) {
        $locationProvider.html5Mode(true);
    }]);

app.controller('CountdownController', ['$scope', '$timeout', '$interval', '$location', '$cookies',
    function($scope, $timeout, $interval, $location, $cookies) {
        $scope.timerRunning = false;
        $scope.countdownEnd = 0;

        var hashTime = 0;

        /**
         * Restores the timer to a previous session
         */
        $scope.restoreTimer = function() {
            var restoreTime = ($location.hash().match(/time=([0-9]+)/));
            if (restoreTime.length == 2) {

                hashTime = restoreTime[1] - 0; // to get a nice _int_
                console.log(hashTime);
                $scope.countdownEnd = hashTime * 1000;

                console.log('countdown now ' + $scope.countdownEnd);
                //$scope.$broadcast('timer-start');
                //$scope.timerRunning = true;
                $timeout($scope.startTimer, 300);
            }
        };

        $scope.startTimer = function () {
            $scope.$broadcast('timer-start');
            $scope.timerRunning = true;

            // save on url hash:
            //window.location.hash = 'time=' + (Math.floor($scope.countdownEnd / 1000))
            $location.hash('time=' + hashTime);
            document.cookie = 'time=' + hashTime + ';Expires=' + (new Date(hashTime * 1000)).toISOString();
        };

        $scope.stopTimer = function (){
            $scope.$broadcast('timer-stop');
            $scope.timerRunning = false;
        };

        $scope.resetTimer = function() {
            $scope.stopTimer();
            $scope.countdownEnd = $scope.days = $scope.hours = $scope.minutes = $scope.seconds = 0;

            $location.hash('');
        };

        $scope.$on('timer-stopped', function (event, data){
            console.log('Timer Stopped - data = ', data);
        });


        // FORMS //
        $scope.setDueDate = function(form) {
            $scope.countdownEnd = (new Date()).setMilliseconds(0);

            $scope.startTimer();
        };

        $scope.setCountdown = function(form) {

            // we need to figure out if they set the timer by typing on the numbers or by setting the dials, or...
            // -- here we adjust the coundownEnd to be the proper one

            var seconds = $scope.countdown,
                timeFinal = (new Date()).setMilliseconds(0) + 1000 * seconds + 1000; // in miliseconds!

            $scope.countdownEnd = timeFinal; // in miliseconds
            console.log("countdown now:", timeFinal);
            hashTime = timeFinal / 1000; // it's integer because timeFinal ends in '...000'

            $scope.startTimer();
        };


        var startCountdown = function(interval) {
            var intervalLoop = $interval(function() {
            }, interval);
        };


        // Retrieving a cookie
        //var favoriteCookie = $cookies.get('myFavorite');
        // Setting a cookie
        //$cookies.put('myFavorite', 'oatmeal');

    }]);