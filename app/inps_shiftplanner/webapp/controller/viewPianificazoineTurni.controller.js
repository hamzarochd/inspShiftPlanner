sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/date/UI5Date",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/unified/DateTypeRange",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator"
], (Controller, JSONModel, UI5Date, MessageToast, MessageBox, DateTypeRange, Filter, FilterOperator) => {
    "use strict";

    return Controller.extend("inpsshiftplanner.controller.viewPianificazoineTurni", {

        onInit() {

            // Converte stringhe ISO in UI5Date usando componenti locali
            // per evitare problemi di timezone (es. data spostata di un giorno)
            function toUI5Date(sISO) {
                if (!sISO) return null;
                // Legge i componenti direttamente dalla stringa ISO
                // evitando qualsiasi conversione di fuso orario da parte di new Date()
                // Funziona sia con "...T00:00:00Z" che senza Z
                const m = sISO.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
                if (!m) return null;
                return UI5Date.getInstance(
                    parseInt(m[1]),       // anno
                    parseInt(m[2]) - 1,   // mese (0-based)
                    parseInt(m[3]),       // giorno
                    parseInt(m[4]),       // ore
                    parseInt(m[5])        // minuti
                );
            }

            // Setto subito il JSONModel vuoto sulla view — così il PlanningCalendar
            // si lega ad esso immediatamente e si aggiorna quando arrivano i dati
            const now = new Date();
            const oViewModel = new JSONModel({
                startDate: UI5Date.getInstance(now.getFullYear(), now.getMonth(), 1),
                dipendenti: []
            });
            this.getView().setModel(oViewModel);

            const oKpiModel = new JSONModel({
                understaffedDays: 0,
                criticalStatus: "Neutral",
                consecutiveCount: 0,
                personaleSenzaMinimoRiposoCount: 0,
                todayCount: 0,
                showConsecutiveHighlight: false,
                showUnderstaffingHighlight: false
            });
            this.getView().setModel(oKpiModel, "kpi");

            // Modello Dipartimenti e Ruoli
            var setRuoli = {
                "RuoliCollezione": [
                    { "key": "COORD",  "text": "Coordinatore infermieristico" },
                    { "key": "INF",    "text": "Infermiere" },
                    { "key": "INF_TI", "text": "Infermiere Terapia Intensiva" },
                    { "key": "OSS",    "text": "Operatore Socio Sanitario (OSS)" },
                    { "key": "AUS",    "text": "Ausiliario/Barelliere" },
                    { "key": "MED",    "text": "Medico" },
                    { "key": "CHIR",   "text": "Chirurgo" },
                    { "key": "ANES",   "text": "Anestesista" },
                    { "key": "SPEC",   "text": "Specializzando" },
                    { "key": "STRUM",  "text": "Strumentista" },
                    { "key": "TEC",    "text": "Tecnico sanitario" },
                    { "key": "FISI",   "text": "Fisioterapista" },
                    { "key": "LOGO",   "text": "Logopedista" },
                    { "key": "SUP",    "text": "Supporto esterno" }
                ],
                "Reparti": [
                    { "key": "PS",    "text": "Pronto Soccorso" },
                    { "key": "TI",    "text": "Terapia Intensiva" },
                    { "key": "MED",   "text": "Medicina Generale" },
                    { "key": "CHIR",  "text": "Chirurgia" },
                    { "key": "SO",    "text": "Sala Operatoria" },
                    { "key": "RAD",   "text": "Radiologia" },
                    { "key": "LAB",   "text": "Laboratorio Analisi" },
                    { "key": "RIAB",  "text": "Riabilitazione" },
                    { "key": "AMB",   "text": "Ambulatorio" },
                    { "key": "DIR",   "text": "Direzione Sanitaria" },
                    { "key": "CARD",  "text": "Cardiologia" },
                    { "key": "ORT",   "text": "Ortopedia" },
                    { "key": "PED",   "text": "Pediatria" },
                    { "key": "GINE",  "text": "Ginecologia" },
                    { "key": "NEURO", "text": "Neurologia" },
                    { "key": "ONCO",  "text": "Oncologia" },
                    { "key": "URO",   "text": "Urologia" },
                    { "key": "PSI",   "text": "Psichiatria" },
                    { "key": "DERM",  "text": "Dermatologia" }
                ],
                "Dipartimenti": [
                    {
                        "Dipartimento": "Emergenza-Urgenza e Area Critica",
                        "reparti": [
                            { "key": "PS",  "text": "Pronto Soccorso e OBI" },
                            { "key": "TI",  "text": "Terapia Intensiva e Rianimazione" },
                            { "key": "118", "text": "Centrale Operativa 118" }
                        ]
                    },
                    {
                        "Dipartimento": "Dipartimento di Chirurgia",
                        "reparti": [
                            { "key": "CHIR", "text": "Chirurgia Generale" },
                            { "key": "SO",   "text": "Blocco Operatorio" },
                            { "key": "URO",  "text": "Urologia" },
                            { "key": "ORT",  "text": "Ortopedia e Traumatologia" }
                        ]
                    },
                    {
                        "Dipartimento": "Dipartimento di Medicina Specialistica",
                        "reparti": [
                            { "key": "MED",   "text": "Medicina Interna" },
                            { "key": "CARD",  "text": "Cardiologia e UTIC" },
                            { "key": "NEURO", "text": "Neurologia" },
                            { "key": "ONCO",  "text": "Oncologia Medica" },
                            { "key": "DERM",  "text": "Dermatologia" }
                        ]
                    },
                    {
                        "Dipartimento": "Dipartimento Materno-Infantile",
                        "reparti": [
                            { "key": "PED",  "text": "Pediatria e Neonatologia" },
                            { "key": "GINE", "text": "Ostetricia e Ginecologia" }
                        ]
                    },
                    {
                        "Dipartimento": "Servizi Diagnostici e Riabilitazione",
                        "reparti": [
                            { "key": "RAD",  "text": "Radiologia e Imaging" },
                            { "key": "LAB",  "text": "Laboratorio Analisi" },
                            { "key": "RIAB", "text": "Medicina Riabilitativa" },
                            { "key": "AMB",  "text": "Poliambulatorio" }
                        ]
                    },
                    {
                        "Dipartimento": "Salute Mentale e Direzione",
                        "reparti": [
                            { "key": "PSI", "text": "Psichiatria (SPDC)" },
                            { "key": "DIR", "text": "Direzione Sanitaria" }
                        ]
                    }
                ]
            };
            this.getView().setModel(new JSONModel(setRuoli), "ruoliModel");

            // Modello per il popover appointment — inizialmente vuoto
            this.getView().setModel(new JSONModel({}), "appt");

            const oODataModel = this.getOwnerComponent().getModel("odata");
            const oListBinding = oODataModel.bindList("/staffs", null, null, null, {
                "$expand": "Appointments"
            });

            oListBinding.requestContexts(0, 9999).then(function(aContexts) {

                const aStaffData = aContexts.map(oCtx => oCtx.getObject());
                // DEBUG — rimuovi dopo aver trovato il problema
                console.log("Staff ricevuti:", aStaffData.length);
                if (aStaffData[0]) {
                    console.log("Primo staff ID:", aStaffData[0].ID);
                    console.log("Appointments del primo staff:", aStaffData[0].Appointments);
                }
                const nowInner = new Date();

                const aDipendenti = aStaffData.map(function(oStaff) {
                    return {
                        name: (oStaff.Name || "") + " " + (oStaff.Surname || ""),
                        role: oStaff.Role || "",
                        department: oStaff.Department || "",
                        repartoKey: oStaff.RepartoKey || "",
                        icon: oStaff.icon || "",
                        highlight: false,
                        teamName: oStaff.MemberOf ? oStaff.MemberOf.Name : "no team",
                        teamID: oStaff.MemberOf ? oStaff.MemberOf.ID : null,
                        shifts: (oStaff.Appointments || []).map(function(oAppt) {
                            return {
                                id: oAppt.ID,
                                startDate: toUI5Date(oAppt.startDate),
                                endDate: toUI5Date(oAppt.endDate),
                                title: oAppt.title || "",
                                type: oAppt.type || "",
                                shiftIcon: oAppt.shiftIcon || "",
                                color: oAppt.color || ""
                            };
                        })
                    };
                });

                // Usa setData sull'istanza esistente — non creare un nuovo JSONModel
                // altrimenti il PlanningCalendar perde il binding
                oViewModel.setData({
                    startDate: UI5Date.getInstance(nowInner.getFullYear(), nowInner.getMonth(), 1),
                    dipendenti: aDipendenti
                });
                oViewModel.refresh(true);

                // Calcolo KPI iniziali
                this.countConsecutive(false);
                this.updateUnderstaffing();
                this.countNonroposoSettimanale(false);

                // Controlla se il DB contiene già dati sovrapposti
                this.checkLoadedOverlaps();

            }.bind(this)).catch(function(oErr) {
                MessageToast.show("Errore caricamento dati: " + oErr.message);
            });
        },

        // Formatta una data come stringa ISO locale (senza conversione UTC)
        // Es: "2024-03-01T00:00:00.000" — il DB salva esattamente quello che vedi
        _toLocalISO: function(d) {
            const p = function(n) { return String(n).padStart(2, "0"); };
            return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
                   "T" + p(d.getHours()) + ":" + p(d.getMinutes()) + ":00.000";
        },

        // Drag & drop: controlla sovrapposizioni e applica o chiede cosa fare
        handleAppointmentDrop: function(oEvent) {
            const oAppointment = oEvent.getParameter("appointment");
            const oStartDate   = oEvent.getParameter("startDate");
            const oCalendarRow = oEvent.getParameter("calendarRow");

            const oModel      = this.getView().getModel();
            const aDipendenti = oModel.getProperty("/dipendenti");

            const oCalendar    = this.byId("planningCalendar");
            const aRows        = oCalendar.getRows();
            const iTargetIndex = aRows.indexOf(oCalendarRow);
            if (iTargetIndex === -1) return;

            const oCtx      = oAppointment.getBindingContext();
            const sApptId   = oCtx.getProperty("id");
            const oOldStart = oCtx.getProperty("startDate");
            const oOldEnd   = oCtx.getProperty("endDate");
            const iDuration = oOldEnd.getTime() - oOldStart.getTime();
            const oNewEnd   = new Date(oStartDate.getTime() + iDuration);

            const iOrigDipIdx   = parseInt(oCtx.getPath().split("/")[2]);
            const aTargetShifts = aDipendenti[iTargetIndex].shifts;

            const oOverlapShift = aTargetShifts.find(function(oShift) {
                if (oShift.id === sApptId) return false;
                return oStartDate < oShift.endDate && oNewEnd > oShift.startDate;
            });

            if (!oOverlapShift) {
                this._applyDrop(sApptId, oStartDate, oNewEnd, iTargetIndex);
                return;
            }

            this._oPendingDrop = {
                sApptId:       sApptId,
                oNewStart:     oStartDate,
                oNewEnd:       oNewEnd,
                iTargetDipIdx: iTargetIndex,
                iOrigDipIdx:   iOrigDipIdx,
                oOrigStart:    oOldStart,
                oOrigEnd:      oOldEnd,
                oOverlapShift: oOverlapShift
            };

            MessageBox.warning(
                "Il turno si sovrappone a \"" + (oOverlapShift.type || "turno esistente") + "\". Cosa vuoi fare?",
                {
                    title: "Sovrapposizione rilevata",
                    actions: ["Sovrascrivi", "Sostituisci", "Cancella"],
                    emphasizedAction: "Sostituisci",
                    onClose: this._onOverlapDialogClose.bind(this)
                }
            );
        },

        // Applica il drop senza sovrapposizioni (aggiorna modello + PATCH DB)
        _applyDrop: function(sApptId, oNewStart, oNewEnd, iTargetDipIdx) {
            const oModel    = this.getView().getModel();
            const aShifts   = oModel.getProperty("/dipendenti/" + iTargetDipIdx + "/shifts");
            const iShiftIdx = aShifts.findIndex(function(s) { return s.id === sApptId; });

            if (iShiftIdx !== -1) {
                oModel.setProperty("/dipendenti/" + iTargetDipIdx + "/shifts/" + iShiftIdx + "/startDate", oNewStart);
                oModel.setProperty("/dipendenti/" + iTargetDipIdx + "/shifts/" + iShiftIdx + "/endDate", oNewEnd);
            }

            fetch("/odata/V4/catalog/appointments(" + sApptId + ")", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ startDate: this._toLocalISO(oNewStart), endDate: this._toLocalISO(oNewEnd) })
            }).then(function(oRes) {
                if (!oRes.ok) throw new Error("PATCH fallito: " + oRes.status);
                MessageToast.show("Turno aggiornato");
            }).catch(function(oErr) {
                MessageToast.show("Errore salvataggio: " + oErr.message);
            });
        },

        // Gestisce la scelta dell'utente nel dialog di sovrapposizione
        _onOverlapDialogClose: function(sAction) {
            const oModel = this.getView().getModel();
            const p      = this._oPendingDrop;
            if (!p) return;

            if (sAction === "Sovrascrivi") {
                // Sposta il turno trascinato nella nuova posizione ed elimina quello sovrapposto
                const aShifts     = oModel.getProperty("/dipendenti/" + p.iTargetDipIdx + "/shifts");
                const iDragIdx    = aShifts.findIndex(function(s) { return s.id === p.sApptId; });
                const iOverlapIdx = aShifts.findIndex(function(s) { return s.id === p.oOverlapShift.id; });

                if (iDragIdx !== -1) {
                    oModel.setProperty("/dipendenti/" + p.iTargetDipIdx + "/shifts/" + iDragIdx + "/startDate", p.oNewStart);
                    oModel.setProperty("/dipendenti/" + p.iTargetDipIdx + "/shifts/" + iDragIdx + "/endDate", p.oNewEnd);
                }
                if (iOverlapIdx !== -1) {
                    aShifts.splice(iOverlapIdx, 1);
                    oModel.setProperty("/dipendenti/" + p.iTargetDipIdx + "/shifts", aShifts);
                }
                oModel.refresh(true);

                Promise.all([
                    fetch("/odata/V4/catalog/appointments(" + p.sApptId + ")", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ startDate: this._toLocalISO(p.oNewStart), endDate: this._toLocalISO(p.oNewEnd) })
                    }),
                    fetch("/odata/V4/catalog/appointments(" + p.oOverlapShift.id + ")", { method: "DELETE" })
                ]).then(function(aRes) {
                    if (aRes.some(function(r) { return !r.ok; })) throw new Error("Operazione fallita");
                    MessageToast.show("Turno spostato, turno sovrapposto eliminato");
                }).catch(function(oErr) { MessageToast.show("Errore: " + oErr.message); });

            } else if (sAction === "Sostituisci") {
                // Scambia le posizioni dei due turni
                const aShifts     = oModel.getProperty("/dipendenti/" + p.iTargetDipIdx + "/shifts");
                const iDragIdx    = aShifts.findIndex(function(s) { return s.id === p.sApptId; });
                const iOverlapIdx = aShifts.findIndex(function(s) { return s.id === p.oOverlapShift.id; });

                if (iDragIdx !== -1) {
                    oModel.setProperty("/dipendenti/" + p.iTargetDipIdx + "/shifts/" + iDragIdx + "/startDate", p.oNewStart);
                    oModel.setProperty("/dipendenti/" + p.iTargetDipIdx + "/shifts/" + iDragIdx + "/endDate", p.oNewEnd);
                }
                if (iOverlapIdx !== -1) {
                    oModel.setProperty("/dipendenti/" + p.iTargetDipIdx + "/shifts/" + iOverlapIdx + "/startDate", p.oOrigStart);
                    oModel.setProperty("/dipendenti/" + p.iTargetDipIdx + "/shifts/" + iOverlapIdx + "/endDate", p.oOrigEnd);
                }
                oModel.refresh(true);

                    Promise.all([
                        fetch("/odata/V4/catalog/appointments(" + p.sApptId + ")", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ startDate: this._toLocalISO(p.oNewStart), endDate: this._toLocalISO(p.oNewEnd) })
                        }),
                        fetch("/odata/V4/catalog/appointments(" + p.oOverlapShift.id + ")", {
                            method: "PATCH",
                            headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ startDate: this._toLocalISO(p.oOrigStart), endDate: this._toLocalISO(p.oOrigEnd) })
                        })
                    ]).then(function(aRes) {
                        if (aRes.some(function(r) { return !r.ok; })) throw new Error("PATCH fallito");
                        MessageToast.show("Turni scambiati");
                    }).catch(function(oErr) { MessageToast.show("Errore: " + oErr.message); });

            } else {
                // Cancella: ripristina lo stato visivo senza modifiche
                oModel.refresh(true);
                MessageToast.show("Operazione annullata");
            }

            this._oPendingDrop = null;
        },

        // Controlla se nel DB esistono già turni sovrapposti per lo stesso dipendente
        checkLoadedOverlaps: function() {
            const oModel     = this.getView().getModel();
            const aDipendenti = oModel.getProperty("/dipendenti") || [];
            let iPersoneConSovrapposizioni = 0;

            aDipendenti.forEach(function(oPerson) {
                const aShifts = oPerson.shifts || [];
                let bHaOverlap = false;

                // Confronta ogni coppia di turni della stessa persona
                for (let i = 0; i < aShifts.length; i++) {
                    for (let j = i + 1; j < aShifts.length; j++) {
                        const oA = aShifts[i];
                        const oB = aShifts[j];
                        // Due turni si sovrappongono se A inizia prima che B finisca E A finisce dopo che B inizia
                        if (oA.startDate < oB.endDate && oA.endDate > oB.startDate) {
                            bHaOverlap = true;
                            break;
                        }
                    }
                    if (bHaOverlap) break;
                }

                if (bHaOverlap) {
                    oPerson.highlight = true;
                    iPersoneConSovrapposizioni++;
                }
            });

            if (iPersoneConSovrapposizioni > 0) {
                oModel.refresh(true);
                MessageToast.show(
                    "Attenzione: " + iPersoneConSovrapposizioni +
                    " dipendente/i con turni sovrapposti nel DB"
                );
            }
        },

        // Apre il popover con i dettagli dell'appointment cliccato
        onAppointmentSelect: function(oEvent) {
            const oAppointment = oEvent.getParameter("appointment");
            if (!oAppointment) return;

            // Dati del turno dal binding context dell'appointment
            const oCtx   = oAppointment.getBindingContext();
            const oShift = oCtx.getObject();

            // Nome dipendente dal binding context della riga padre
            const oRow     = oAppointment.getParent();
            const oRowCtx  = oRow ? oRow.getBindingContext() : null;
            const sName    = oRowCtx ? oRowCtx.getProperty("name") : "Turno";

            // Formattazione date leggibile in italiano
            const fmtDate = function(d) {
                if (!d) return "-";
                return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })
                     + "  " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
            };

            // Estrae gli indici dal path del binding context
            // Il path ha formato: /dipendenti/2/shifts/0
            const aParts    = oCtx.getPath().split("/");
            const iDipIndex = parseInt(aParts[2]);
            const iShiftIdx = parseInt(aParts[4]);

            // Popola il modello appt e apre il popover
            this.getView().getModel("appt").setData({
                name:      sName,
                type:      oShift.type      || "-",
                startDate: fmtDate(oShift.startDate),
                endDate:   fmtDate(oShift.endDate),
                id:        oShift.id,
                dipIndex:  iDipIndex,
                shiftIdx:  iShiftIdx
            });

            this.byId("appointmentPopover").openBy(oAppointment);
        },

        onClosePopover: function() {
            this.byId("appointmentPopover").close();
        },

        onDeleteAppointment: function() {
            const oApptModel = this.getView().getModel("appt");
            const sId        = oApptModel.getProperty("/id");
            const iDipIndex  = oApptModel.getProperty("/dipIndex");
            const iShiftIdx  = oApptModel.getProperty("/shiftIdx");

            // DELETE sul DB
            fetch("/odata/V4/catalog/appointments(" + sId + ")", {
                method: "DELETE"
            }).then(function(oRes) {
                if (!oRes.ok) throw new Error("DELETE fallito: " + oRes.status);

                // Rimuove il turno dal modello locale
                const oModel  = this.getView().getModel();
                const aShifts = oModel.getProperty("/dipendenti/" + iDipIndex + "/shifts");
                aShifts.splice(iShiftIdx, 1);
                oModel.setProperty("/dipendenti/" + iDipIndex + "/shifts", aShifts);
                oModel.refresh(true);

                this.byId("appointmentPopover").close();
                MessageToast.show("Turno eliminato");
            }.bind(this)).catch(function(oErr) {
                MessageToast.show("Errore eliminazione: " + oErr.message);
            });

            this.onAfterModifyData();
        },

        onSearch: function() {
            const sRuoloChiave    = this.byId("roleFilterCombo").getSelectedKey();
            const sDipartimento   = this.byId("Dipartimenti").getSelectedKey();
            const sRepartoChiave  = this.byId("repartoFilterCombo").getSelectedKey();

            const oCalendar = this.byId("planningCalendar");
            const oBinding  = oCalendar.getBinding("rows");
            const aFiltri   = [];

            if (sRuoloChiave) {
                aFiltri.push(new Filter("role", FilterOperator.EQ, sRuoloChiave));
            }
            if (sDipartimento) {
                aFiltri.push(new Filter("department", FilterOperator.EQ, sDipartimento));
            }
            if (sRepartoChiave) {
                aFiltri.push(new Filter("repartoKey", FilterOperator.EQ, sRepartoChiave));
            }

            if (oBinding) {
                oBinding.filter(aFiltri);
                MessageToast.show("Risultati aggiornati");
            }
        },

        onResetFilters: function() {
            this.byId("roleFilterCombo").setSelectedKey("");
            this.byId("Dipartimenti").setSelectedKey("");
            this.byId("repartoFilterCombo").setSelectedKey("");

            const oBinding = this.byId("planningCalendar").getBinding("rows");
            if (oBinding) {
                oBinding.filter([]);
            }
            MessageToast.show("Filtri resettati");
        },

        onPressMancanzaPersonale: function() {
            const oKpiModel = this.getView().getModel("kpi");
            const bActive   = oKpiModel.getProperty("/showUnderstaffingHighlight");
            oKpiModel.setProperty("/showUnderstaffingHighlight", !bActive);

            const oCalendar = this.byId("planningCalendar");
            if (!bActive) {
                this.updateUnderstaffing(true);
            } else {
                oCalendar?.removeAllSpecialDates();
                MessageToast.show("Evidenziazione rimossa");
            }
        },


//// definisco una funzione che recupera l'anno, il mese ed quanti giorni in quel mese:::.

        GGMMAA: function(){
            const oCalendar = this.byId("planningCalendar");
            const oStartDate = oCalendar?.getStartDate() || new Date();

            const iYear = oStartDate.getFullYear();
            const iMonth = oStartDate.getMonth();
            const iDaysInMonth = new Date(iYear, iMonth + 1, 0).getDate();

            return {iYear,iMonth,iDaysInMonth};
        },

        /////// funzione da chiamare all'interno di kpiCountDay-


        updateUnderstaffing: function(bUpdateCalendar) { //// true oppure false
            const oModel = this.getView().getModel(); // modello default (no nome)
            const oKpiModel = this.getView().getModel("kpi");
            const oCalendar = this.byId("planningCalendar");

            const aStaff = oModel?.getProperty("/dipendenti") || [];

            /*const oStartDate = oCalendar?.getStartDate() || new Date();
            const iYear = oStartDate.getFullYear();
            const iMonth = oStartDate.getMonth();
            const iDaysInMonth = new Date(iYear, iMonth + 1, 0).getDate();*/

            const {iYear,iMonth,iDaysInMonth} = this.GGMMAA();

            const staffCountByDate = {};
            aStaff.forEach(person => {
                person.shifts?.forEach(appointment => {
                    if (appointment.type && appointment.type !== "RIPOSO") { 
                        const sDate = new Date(appointment.startDate).toDateString();
                        staffCountByDate[sDate] = (staffCountByDate[sDate] || 0) + 1;
                    }
                });
            });

            let iCriticalDays = 0;
            if (bUpdateCalendar) oCalendar?.removeAllSpecialDates();

            for (let d = 1; d <= iDaysInMonth; d++) {
                const oDate = new Date(iYear, iMonth, d);
                const isWeekend = (oDate.getDay() === 0 || oDate.getDay() === 6);
                const threshold = isWeekend ? 3 : 5; //////// per test: min 2 per il weekend, min 3 durante i giorni lavorativi.
                const count = staffCountByDate[oDate.toDateString()] || 0;

                if (count < threshold) {
                    iCriticalDays++;
                    if (bUpdateCalendar) { ///// perché adesso il showUnderstaffingHighlight risulta true.
                        oCalendar?.addSpecialDate(new DateTypeRange({
                            startDate: oDate
                        }));
                    }
                }
            }

            oKpiModel?.setProperty("/understaffedDays", iCriticalDays);
            oKpiModel?.setProperty("/criticalStatus", iCriticalDays > 0 ? "Critical" : "Success");

            
            
            if (bUpdateCalendar && iCriticalDays > 0) {
                MessageToast.show("Trovati " + iCriticalDays + " giorni sottorganico");
            }
        },

        ////////// per tile Rischio salute:::
        /////// non più di 6 giorni consecutivi.


        onPressRischioSalute: function(bIsRefreshOnly) {
            const oKpiModel = this.getView().getModel("kpi");
            let bNewActive;

            if (bIsRefreshOnly === true) {

                bNewActive = oKpiModel.getProperty("/showConsecutiveHighlight") || false;
            } else {

                const bCurrentlyActive = oKpiModel.getProperty("/showConsecutiveHighlight") || false;
                bNewActive = !bCurrentlyActive;
                oKpiModel.setProperty("/showConsecutiveHighlight", bNewActive);
                
                if (bNewActive) {
                    MessageToast.show('Evidenziazione rischio salute attiva');
                } else {
                    MessageToast.show('Evidenziazione rimossa');
                }
            }

            this.countConsecutive(bNewActive);
        },


        countConsecutive: function(bShouldHighlight) {

            ////// recuperare i modelli::::::
            const oModel = this.getView().getModel(); 
            const oKpiModel = this.getView().getModel("kpi");
            const oCalendar = this.byId("planningCalendar");

            const limitDays = 3; 
            const { iYear, iMonth, iDaysInMonth } = this.GGMMAA();
            

            /// tot count
            let iTotalViolatingPeople = 0; 

            const aStaff = oModel.getProperty("/dipendenti") || [];
            const aRows = oCalendar ? oCalendar.getRows() : [];

            aStaff.forEach((person, index) => {
                let iConsecutiveCounter = 0; 
                let bPersonViolates = false;
                const oRow = aRows[index];


                if (oRow) {
                    oRow.destroySpecialDates();
                }

                const personalShifts = {};
                if (person.shifts) {
                    person.shifts.forEach(shift => {
                        if (shift.type && shift.type !== "RIPOSO") {
                            const sDate = new Date(shift.startDate).toDateString();
                            personalShifts[sDate] = true;
                        }
                    });
                }


                ///// prendere tutti i giorni del mese
                for (let d = 1; d <= iDaysInMonth; d++) {
                    const oCurrentDate = new Date(iYear, iMonth, d);
                    const tempDate = oCurrentDate.toDateString();

                    //// se si (per almeno una volta)
                    if (personalShifts[tempDate]) {
                        iConsecutiveCounter++;
                    } else {
                        iConsecutiveCounter = 0; 
                    }

                if (iConsecutiveCounter > limitDays) {
                    bPersonViolates = true;

                    if (bShouldHighlight && oRow) {
                        if (iConsecutiveCounter === limitDays + 1) {
                            for (let back = 0; back < limitDays; back++) {
                                const oBackDate = new Date(iYear, iMonth, d - (limitDays - back));
                                oRow.addSpecialDate(new DateTypeRange({
                                    startDate: oBackDate,
                                    type: "NonWorking" 
                                }));
                            }
                        }


                        oRow.addSpecialDate(new DateTypeRange({
                            startDate: new Date(oCurrentDate),
                            type: "NonWorking" 
                        }));
                    }
                }
            }
                
                //!!!!!! per evidenziare la persona
            person.highlight = bShouldHighlight && bPersonViolates;

            if (bPersonViolates) {
                iTotalViolatingPeople++;
            }
            });

            

            oModel.refresh(true);

            oKpiModel.setProperty("/consecutiveCount", iTotalViolatingPeople);
            oKpiModel.setProperty("/consecutiveStatus", iTotalViolatingPeople > 0 ? "Warning" : "Success");
        },


/////////////// minimo una casella di riposo per ogni settimana!!!! 
//////---> verrà fuori il numero di personale che non soddisfa la condizone.

////// va nell  kpi/personaleSenzaMinimoRiposoCount ---> per default 0;

        onPressMancazaRiposso: function() {
            const oKpiModel = this.getView().getModel("kpi");

            const bCurrentlyActive = oKpiModel.getProperty("/showConsecutiveHighlight") || false;
            const bNewActive = !bCurrentlyActive;
            
            oKpiModel.setProperty("/showConsecutiveHighlight", bNewActive);
            
            const TotPersonale = this.countNonroposoSettimanale(bNewActive);

            
            //const sStatus = TotPersonale > 0 ? "Error" : "Success";
            //oKpiModel.setProperty("/restStatus", sStatus); 

            if (TotPersonale > 0) {
                MessageToast.show("Attenzione: " + TotPersonale + " staffs senza riposo settimanale.");
            } else {
                MessageToast.show("Tutto in regola: ogni dipendente ha almeno un riposo a settimana.");
            }
        },

       


        ////// la funzione da chiamare al interno di onPressMancanzaRiposo


        countNonroposoSettimanale: function(bShouldHighlight) {
            const oModel = this.getView().getModel();
            const oKpiModel = this.getView().getModel("kpi");
            const { iYear, iMonth, iDaysInMonth } = this.GGMMAA();

            let iTotViolazioni = 0;
            const aStaff = oModel.getProperty("/dipendenti") || [];

            aStaff.forEach(person => {
                let bMancaRiposo = false;
                
                // Estrazione dei giorni di riposo
                const restDays = {};
                if (person.shifts) {
                    person.shifts.forEach(shift => {
                        if (shift.type === "RIPOSO" && shift.startDate) { ///// emergenza --> per test
                            restDays[new Date(shift.startDate).toDateString()] = true;
                        }
                    });
                }

                // Trova il primo lunedì del mese per iniziare il conteggio delle settimane
                let iStartDay = 1;
                while (iStartDay <= iDaysInMonth) {
                    let oTempDate = new Date(iYear, iMonth, iStartDay);
                    if (oTempDate.getDay() === 1) break;
                    iStartDay++;
                }

                //////// Ciclo per ogni settimana intera del mese
                for (let weekStart = iStartDay; weekStart + 6 <= iDaysInMonth; weekStart += 7) {
                    let bHaRiposatoInSettimana = false;

                    //////// Controlla i 7 giorni della settimana corrente
                    for (let d = 0; d < 7; d++) {
                        let currentCheckDate = new Date(iYear, iMonth, weekStart + d);
                        if (restDays[currentCheckDate.toDateString()]) {
                            bHaRiposatoInSettimana = true;
                            break; 
                        }
                    }

                    /////// persona no valida ---> almeno una settimana.
                    if (!bHaRiposatoInSettimana) {
                        bMancaRiposo = true;
                        break;         
                    }
                }

                //!!!!!!!Imposta highlight a true se richiesto e se c'è violazione
                person.highlight = bShouldHighlight && bMancaRiposo;

                if (bMancaRiposo) {
                    iTotViolazioni++;
                }
            });

            oKpiModel.setProperty("/personaleSenzaMinimoRiposoCount", iTotViolazioni);
            

            oModel.refresh(true);
            
            return iTotViolazioni;
        },


        //////// per aggiornare kpi in: drag & drop(ok), delete(not ok) ...

        onAfterModifyData: function() {
            const oLocalModel = this.getView().getModel();

            oLocalModel.refresh(true);


            //// calcoli kpi
            this.countConsecutive(false);
            this.updateUnderstaffing();
            this.countNonroposoSettimanale(false);

            //// evidenzia kpi::
            this.onPressRischioSalute(true);
            this.onPressMancanzaPersonale(true);
            this.onPressMancazaRiposso(true);
        },


    });
});
