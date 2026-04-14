sap.ui.define([], function () {
    "use strict";
    return {
        formatType: function (sStatus) {
            switch (sStatus) {
                case "Mattina":
                    return "Type06"; // Verde
                case "Pomeriggio":
                    return "Type05"; // Giallo/Arancio
                case "Notte":
                    return "Type01"; // Blu/Rosso
                default:
                    return "Type09"; // Grigio
            }
        }
    };
});