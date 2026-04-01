using { cuid } from '@sap/cds/common';

//namespace my;
/*
entity Products {
    key ID : Integer;
    name   : String;
    price  : Decimal;
}*/

// entity appointments : cuid {

//     title     : String;
//     type      : String;
//     startDate : Timestamp;
//     endDate   : Timestamp;
//     text      : String;
//     notes     : String;
//   };

context inpsShiftPlanner {

////// gli staff
    entity staffs : cuid {
        Name       : String;
        Surname    : String;
        Role       : String;
        icon       : String;
        Appointments     : Composition of many appointments on Appointments.ID_Utente = $self.ID;
    }


    entity appointments : cuid {

        ID_Utente : UUID;
        title     : String;
        type      : String;
        startDate : Timestamp;
        endDate   : Timestamp;
        text      : String;
        notes     : String;
        shiftIcon  : String;   ///---> va presa con il modello fuori --> per title prendonno l'icona
        color      : String; 
    }
}