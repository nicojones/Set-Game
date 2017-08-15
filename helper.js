app.factory('helper', function() {
    var helper = {
        addZero: function(number) {
            if (number < 10) {
                return '0' + number;
            }
            return number;
        }
    };

    return helper;
});