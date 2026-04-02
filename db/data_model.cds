using {cuid} from '@sap/cds/common';


context inpsShiftPlanner {

    ////// gli staff
    entity staffs : cuid {
        Name         : String;
        Surname      : String;
        Role         : String;
        icon         : String;
        Appointments : Composition of many appointments
                           on Appointments.ID_Utente = $self.ID
                                            @assert.target;
        MemberOf     : Association to teams @assert.target;

    }

    entity appointments : cuid {
        ID_Utente : UUID;
        title     : String;
        type      : String;
        startDate : Timestamp;
        endDate   : Timestamp;
        text      : String;
        notes     : String;
        shiftIcon : String; ///---> va presa con il modello fuori --> per title prendonno l'icona
        color     : String;
    }


    /////// composizione team.
    entity teams : cuid {
        Name    : String;
        Leader  : Association to staffs @assert.target;
        Members : Association to many staffs
                      on Members.MemberOf = $self;
    }
}