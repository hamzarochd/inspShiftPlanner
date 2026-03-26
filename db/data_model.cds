using { cuid } from '@sap/cds/common';

namespace my;

entity Products {
    key ID : Integer;
    name   : String;
    price  : Decimal;
}

entity appointments : cuid {

    ID_Utente : UUID;
    title     : String;
    type      : String;
    startDate : Timestamp;
    endDate   : Timestamp;
    text      : String;
    notes     : String;
  };