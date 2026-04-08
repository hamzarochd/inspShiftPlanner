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
                    { "key": "Coordinatore infermieristico", "text": "Coordinatore infermieristico" },
                    { "key": "Infermiere", "text": "Infermiere" },
                    { "key": "Infermiere Terapia Intensiva", "text": "Infermiere Terapia Intensiva" },
                    { "key": "Operatore Socio Sanitario (OSS)", "text": "Operatore Socio Sanitario (OSS)" },
                    { "key": "Ausiliario/Barelliere", "text": "Ausiliario/Barelliere" },
                    { "key": "Medico", "text": "Medico" },
                    { "key": "Chirurgo", "text": "Chirurgo" },
                    { "key": "Anestesista", "text": "Anestesista" },
                    { "key": "Specializzando", "text": "Specializzando" },
                    { "key": "Strumentista", "text": "Strumentista" },
                    { "key": "Tecnico sanitario", "text": "Tecnico sanitario" },
                    { "key": "Fisioterapista", "text": "Fisioterapista" },
                    { "key": "Logopedista", "text": "Logopedista" },
                    { "key": "Supporto esterno", "text": "Supporto esterno" }
                ],
                "Reparti": [
                    { "key": "EMERGENZA", "text": "Emergenza / PS" },
                    { "key": "DIAGNOSTICA", "text": "Diagnostica" },
                    { "key": "AFFIANCAMENTO", "text": "Affiancamento" },
                    { "key": "REPERIBILITA", "text": "Reperibilità" },
                    { "key": "RIPOSO", "text": "Riposo" }
                ],
                "TipiTurno": [
                    { "key": "AFFIANCAMENTO", "text": "Affiancamento", "color": "#0070F2", "title": "Affiancamento", "shiftIcon": "" },
                    { "key": "DIAGNOSTICA", "text": "Diagnostica", "color": "#E76500", "title": "Diagnostica", "shiftIcon": "" },
                    { "key": "EMERGENZA", "text": "Emergenza", "color": "#D20000", "title": "Emergenza", "shiftIcon": "" },
                    { "key": "REPERIBILITA", "text": "Reperibilità", "color": "#0A6ED1", "title": "Reperibilità", "shiftIcon": "" },
                    { "key": "RIPOSO", "text": "Riposo", "color": "#8B8B8B", "title": "Riposo", "shiftIcon": "" }
                ],
                "TeamFiltro": [
                    { "key": "Pronto Soccorso", "text": "Pronto Soccorso" },
                    { "key": "Terapia Intensiva", "text": "Terapia Intensiva" },
                    { "key": "Medicina Generale", "text": "Medicina Generale" },
                    { "key": "Chirurgia", "text": "Chirurgia" },
                    { "key": "Sala Operatoria", "text": "Sala Operatoria" }
                ]
            };
            this.getView().setModel(new JSONModel(setRuoli), "ruoliModel");

            // Modello per il popover appointment — inizialmente vuoto
            this.getView().setModel(new JSONModel({}), "appt");
            // Modello per il dialog di modifica
            this.getView().setModel(new JSONModel({}), "editAppt");
            // Modello per il dialog di creazione
            this.getView().setModel(new JSONModel({}), "newAppt");
            // Modello per il dialog di duplicazione
            this.getView().setModel(new JSONModel({}), "dupAppt");

            const oODataModel = this.getOwnerComponent().getModel("odata");
            const oListBinding = oODataModel.bindList("/staffs", null, null, null, {
                "$expand": "Appointments,MemberOf"
            });

            oListBinding.requestContexts(0, 9999).then(function (aContexts) {

                // Mappa tipo → { shiftIcon, color, title } per derivare icone/colori mancanti
                const aTipi = this.getView().getModel("ruoliModel").getProperty("/TipiTurno");
                const oTipoMap = {};
                aTipi.forEach(function (t) { oTipoMap[t.key] = t; });

                const aStaffData = aContexts.map(oCtx => oCtx.getObject());
                // DEBUG — rimuovi dopo aver trovato il problema
                console.log("Staff ricevuti:", aStaffData.length);
                if (aStaffData[0]) {
                    console.log("Primo staff ID:", aStaffData[0].ID);
                    console.log("Appointments del primo staff:", aStaffData[0].Appointments);
                }
                const nowInner = new Date();

                const aDipendenti = aStaffData.map(function (oStaff) {
                    const sTeamName = oStaff.MemberOf ? oStaff.MemberOf.Name : "no team";
                    return {
                        staffId: oStaff.ID,
                        name: (oStaff.Name || "") + " " + (oStaff.Surname || ""),
                        role: oStaff.Role || "",
                        teamName: sTeamName,
                        //repartoKey: sTeamName,
                        icon: oStaff.icon || "",
                        highlight: false,
                        //teamName: sTeamName,
                        teamID: oStaff.MemberOf ? oStaff.MemberOf.ID : null,
                        shifts: (oStaff.Appointments || []).map(function (oAppt) {

                            const oTipoConfig = oTipoMap[oAppt.type] || {};

                            return {
                                id: oAppt.ID,
                                startDate: toUI5Date(oAppt.startDate),
                                endDate: toUI5Date(oAppt.endDate),
                                type: oAppt.type || "",
                                title: oAppt.title || oTipoConfig.title || "",
                                shiftIcon: oAppt.shiftIcon || oTipoConfig.shiftIcon || "",
                                color: oAppt.color || oTipoConfig.color || ""
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

            }.bind(this)).catch(function (oErr) {
                MessageToast.show("Errore caricamento dati: " + oErr.message);
            });
        },

        // Formatta una data come stringa ISO locale (senza conversione UTC)
        // Es: "2024-03-01T00:00:00.000" — il DB salva esattamente quello che vedi
        _toLocalISO: function (d) {
            const p = function (n) { return String(n).padStart(2, "0"); };
            return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) +
                "T" + p(d.getHours()) + ":" + p(d.getMinutes()) + ":00.000";
        },

        // Drag & drop: controlla sovrapposizioni e applica o chiede cosa fare
        handleAppointmentDrop: function (oEvent) {
            const oAppointment = oEvent.getParameter("appointment");
            const oStartDate = oEvent.getParameter("startDate");
            const oCalendarRow = oEvent.getParameter("calendarRow");

            const oModel = this.getView().getModel();
            const aDipendenti = oModel.getProperty("/dipendenti");

            const oCalendar = this.byId("planningCalendar");
            const aRows = oCalendar.getRows();
            const iTargetIndex = aRows.indexOf(oCalendarRow);
            if (iTargetIndex === -1) return;

            const oCtx = oAppointment.getBindingContext();
            const sApptId = oCtx.getProperty("id");
            const oOldStart = oCtx.getProperty("startDate");
            const oOldEnd = oCtx.getProperty("endDate");
            const iDuration = oOldEnd.getTime() - oOldStart.getTime();
            const oNewEnd = new Date(oStartDate.getTime() + iDuration);

            const iOrigDipIdx = parseInt(oCtx.getPath().split("/")[2]);
            const aTargetShifts = aDipendenti[iTargetIndex].shifts;

            const oOverlapShift = aTargetShifts.find(function (oShift) {
                if (oShift.id === sApptId) return false;
                return oStartDate < oShift.endDate && oNewEnd > oShift.startDate;
            });

            if (!oOverlapShift) {
                this._applyDrop(sApptId, oStartDate, oNewEnd, iTargetIndex);
                return;
            }

            this._oPendingDrop = {
                sApptId: sApptId,
                oNewStart: oStartDate,
                oNewEnd: oNewEnd,
                iTargetDipIdx: iTargetIndex,
                iOrigDipIdx: iOrigDipIdx,
                oOrigStart: oOldStart,
                oOrigEnd: oOldEnd,
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
        _applyDrop: function (sApptId, oNewStart, oNewEnd, iTargetDipIdx) {
            const oModel = this.getView().getModel();
            const aShifts = oModel.getProperty("/dipendenti/" + iTargetDipIdx + "/shifts");
            const iShiftIdx = aShifts.findIndex(function (s) { return s.id === sApptId; });

            if (iShiftIdx !== -1) {
                oModel.setProperty("/dipendenti/" + iTargetDipIdx + "/shifts/" + iShiftIdx + "/startDate", oNewStart);
                oModel.setProperty("/dipendenti/" + iTargetDipIdx + "/shifts/" + iShiftIdx + "/endDate", oNewEnd);
            }

            fetch("/odata/V4/catalog/appointments(" + sApptId + ")", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ startDate: this._toLocalISO(oNewStart), endDate: this._toLocalISO(oNewEnd) })
            }).then(function (oRes) {
                if (!oRes.ok) throw new Error("PATCH fallito: " + oRes.status);
                MessageToast.show("Turno aggiornato");


            }).catch(function (oErr) {
                MessageToast.show("Errore salvataggio: " + oErr.message);
            });

            this.onAfterModifyData();

        },

        // Gestisce la scelta dell'utente nel dialog di sovrapposizione
        _onOverlapDialogClose: function (sAction) {
            const oModel = this.getView().getModel();
            const p = this._oPendingDrop;
            if (!p) return;

            if (sAction === "Sovrascrivi") {
                // Sposta il turno trascinato nella nuova posizione ed elimina quello sovrapposto
                const aShifts = oModel.getProperty("/dipendenti/" + p.iTargetDipIdx + "/shifts");
                const iDragIdx = aShifts.findIndex(function (s) { return s.id === p.sApptId; });
                const iOverlapIdx = aShifts.findIndex(function (s) { return s.id === p.oOverlapShift.id; });

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
                ]).then(function (aRes) {
                    if (aRes.some(function (r) { return !r.ok; })) throw new Error("Operazione fallita");
                    MessageToast.show("Turno spostato, turno sovrapposto eliminato");
                }).catch(function (oErr) { MessageToast.show("Errore: " + oErr.message); });

            } else if (sAction === "Sostituisci") {
                // Scambia le posizioni dei due turni
                const aShifts = oModel.getProperty("/dipendenti/" + p.iTargetDipIdx + "/shifts");
                const iDragIdx = aShifts.findIndex(function (s) { return s.id === p.sApptId; });
                const iOverlapIdx = aShifts.findIndex(function (s) { return s.id === p.oOverlapShift.id; });

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
                ]).then(function (aRes) {
                    if (aRes.some(function (r) { return !r.ok; })) throw new Error("PATCH fallito");
                    MessageToast.show("Turni scambiati");
                }).catch(function (oErr) { MessageToast.show("Errore: " + oErr.message); });

            } else {
                // Cancella: ripristina lo stato visivo senza modifiche
                oModel.refresh(true);
                MessageToast.show("Operazione annullata");
            }

            this._oPendingDrop = null;
        },

        // Controlla se nel DB esistono già turni sovrapposti per lo stesso dipendente
        checkLoadedOverlaps: function () {
            const oModel = this.getView().getModel();
            const aDipendenti = oModel.getProperty("/dipendenti") || [];
            let iPersoneConSovrapposizioni = 0;

            aDipendenti.forEach(function (oPerson) {
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
        onAppointmentSelect: function (oEvent) {
            const oAppointment = oEvent.getParameter("appointment");
            if (!oAppointment) return;

            // Dati del turno dal binding context dell'appointment
            const oCtx = oAppointment.getBindingContext();
            const oShift = oCtx.getObject();

            // Nome dipendente dal binding context della riga padre
            const oRow = oAppointment.getParent();
            const oRowCtx = oRow ? oRow.getBindingContext() : null;
            const sName = oRowCtx ? oRowCtx.getProperty("name") : "Turno";

            // Formattazione date leggibile in italiano
            const fmtDate = function (d) {
                if (!d) return "-";
                return d.toLocaleDateString("it-IT", { day: "2-digit", month: "2-digit", year: "numeric" })
                    + "  " + d.toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" });
            };

            // Estrae gli indici dal path del binding context
            // Il path ha formato: /dipendenti/2/shifts/0
            const aParts = oCtx.getPath().split("/");
            const iDipIndex = parseInt(aParts[2]);
            const iShiftIdx = parseInt(aParts[4]);

            // Popola il modello appt e apre il popover
            this.getView().getModel("appt").setData({
                name: sName,
                type: oShift.type || "-",
                startDate: fmtDate(oShift.startDate),
                endDate: fmtDate(oShift.endDate),
                id: oShift.id,
                dipIndex: iDipIndex,
                shiftIdx: iShiftIdx
            });

            this.byId("appointmentPopover").openBy(oAppointment);
        },

        onClosePopover: function () {
            this.byId("appointmentPopover").close();
        },

        onEditAppointment: function () {
            this.byId("appointmentPopover").close();

            // Prende indici e dati dal modello appt
            const oApptModel = this.getView().getModel("appt");
            const iDipIdx = oApptModel.getProperty("/dipIndex");
            const iShiftIdx = oApptModel.getProperty("/shiftIdx");
            const oShift = this.getView().getModel().getProperty(
                "/dipendenti/" + iDipIdx + "/shifts/" + iShiftIdx
            );

            // Popola il modello editAppt con i dati attuali del turno
            this.getView().getModel("editAppt").setData({
                id: oShift.id,
                type: oShift.type || "",
                color: oShift.color || "",
                shiftIcon: oShift.shiftIcon || "",
                title: oShift.title || "",
                startDate: oShift.startDate,
                endDate: oShift.endDate,
                dipIndex: iDipIdx,
                shiftIdx: iShiftIdx
            });

            this.byId("editAppointmentDialog").open();

            this.onAfterModifyData();
        },

        // Quando l'utente cambia il tipo nel Select, aggiorna colore/icona/titolo
        onEditTypeChange: function (oEvent) {
            const sKey = oEvent.getSource().getSelectedKey();
            const aTipi = this.getView().getModel("ruoliModel").getProperty("/TipiTurno");
            const oTipo = aTipi.find(function (t) { return t.key === sKey; });
            if (!oTipo) return;

            const oEditModel = this.getView().getModel("editAppt");
            oEditModel.setProperty("/color", oTipo.color);
            oEditModel.setProperty("/shiftIcon", oTipo.shiftIcon);
            oEditModel.setProperty("/title", oTipo.title);
        },

        onSaveEditAppointment: function () {
            const oEditModel = this.getView().getModel("editAppt");
            const sId = oEditModel.getProperty("/id");
            const sType = oEditModel.getProperty("/type");

            // Ricava sempre icona/colore/titolo dalla mappa TipiTurno (fonte di verità)
            const aTipiEdit = this.getView().getModel("ruoliModel").getProperty("/TipiTurno");
            const oTipoEdit = aTipiEdit.find(function (t) { return t.key === sType; }) || {};
            const sColor = oTipoEdit.color || oEditModel.getProperty("/color") || "";
            const sShiftIcon = oTipoEdit.shiftIcon || oEditModel.getProperty("/shiftIcon") || "";
            const sTitle = oTipoEdit.title || oEditModel.getProperty("/title") || "";
            const iDipIdx = oEditModel.getProperty("/dipIndex");
            const iShiftIdx = oEditModel.getProperty("/shiftIdx");

            const oStart = this.byId("editStartPicker").getDateValue();
            const oEnd = this.byId("editEndPicker").getDateValue();

            if (!oStart || !oEnd) {
                MessageToast.show("Inserisci date valide");
                return;
            }

            // Aggiorna il modello locale — il calendario si aggiorna subito
            const oModel = this.getView().getModel();
            const sBase = "/dipendenti/" + iDipIdx + "/shifts/" + iShiftIdx;
            oModel.setProperty(sBase + "/type", sType);
            oModel.setProperty(sBase + "/color", sColor);
            oModel.setProperty(sBase + "/shiftIcon", sShiftIcon);
            oModel.setProperty(sBase + "/title", sTitle);
            oModel.setProperty(sBase + "/startDate", oStart);
            oModel.setProperty(sBase + "/endDate", oEnd);
            oModel.refresh(true);

            // PATCH al DB
            fetch("/odata/V4/catalog/appointments(" + sId + ")", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    type: sType,
                    color: sColor,
                    shiftIcon: sShiftIcon,
                    title: sTitle,
                    startDate: this._toLocalISO(oStart),
                    endDate: this._toLocalISO(oEnd)
                })
            }).then(function (oRes) {
                if (!oRes.ok) throw new Error("PATCH fallito: " + oRes.status);
                MessageToast.show("Turno modificato");
            }).catch(function (oErr) {
                MessageToast.show("Errore: " + oErr.message);
            });

            this.byId("editAppointmentDialog").close();

            this.onAfterModifyData();
        },

        onCancelEditAppointment: function () {
            this.byId("editAppointmentDialog").close();

            this.onAfterModifyData();
        },

        onDeleteAppointment: function () {
            const oApptModel = this.getView().getModel("appt");
            const sId = oApptModel.getProperty("/id");
            const iDipIndex = oApptModel.getProperty("/dipIndex");
            const iShiftIdx = oApptModel.getProperty("/shiftIdx");

            // DELETE sul DB
            fetch("/odata/V4/catalog/appointments(" + sId + ")", {
                method: "DELETE"
            }).then(function (oRes) {
                if (!oRes.ok) throw new Error("DELETE fallito: " + oRes.status);

                // Rimuove il turno dal modello locale
                const oModel = this.getView().getModel();
                const aShifts = oModel.getProperty("/dipendenti/" + iDipIndex + "/shifts");
                aShifts.splice(iShiftIdx, 1);
                oModel.setProperty("/dipendenti/" + iDipIndex + "/shifts", aShifts);

                this.onAfterModifyData();

                oModel.refresh(true);

                this.byId("appointmentPopover").close();
                MessageToast.show("Turno eliminato");
            }.bind(this)).catch(function (oErr) {
                MessageToast.show("Errore eliminazione: " + oErr.message);
            });
        },

        onDuplicateAppointment: function () {
            this.byId("appointmentPopover").close();

            const oApptModel = this.getView().getModel("appt");
            const iDipIdx = oApptModel.getProperty("/dipIndex");
            const iShiftIdx = oApptModel.getProperty("/shiftIdx");
            const oModel = this.getView().getModel();
            const oDip = oModel.getProperty("/dipendenti/" + iDipIdx);
            const oShift = oModel.getProperty("/dipendenti/" + iDipIdx + "/shifts/" + iShiftIdx);

            // Trova la prima data libera dopo l'appointment originale
            const aShifts = oModel.getProperty("/dipendenti/" + iDipIdx + "/shifts") || [];
            const oOccupied = new Set(aShifts.map(function (s) {
                const d = s.startDate instanceof Date ? s.startDate : new Date(s.startDate);
                return d.toDateString();
            }));
            const oOrigStart = oShift.startDate instanceof Date ? oShift.startDate : new Date(oShift.startDate);
            const oOrigEnd = oShift.endDate instanceof Date ? oShift.endDate : new Date(oShift.endDate);
            const iDuration = oOrigEnd.getTime() - oOrigStart.getTime();

            const oCandidate = new Date(oOrigStart);
            oCandidate.setDate(oCandidate.getDate() + 1);
            while (oOccupied.has(oCandidate.toDateString())) {
                oCandidate.setDate(oCandidate.getDate() + 1);
            }
            const oFirstAvailStart = new Date(oCandidate);
            oFirstAvailStart.setHours(oOrigStart.getHours(), oOrigStart.getMinutes(), 0, 0);
            const oFirstAvailEnd = new Date(oFirstAvailStart.getTime() + iDuration);

            this.getView().getModel("dupAppt").setData({
                type: oShift.type || "",
                color: oShift.color || "",
                shiftIcon: oShift.shiftIcon || "",
                title: oShift.title || "",
                startDate: oFirstAvailStart,
                endDate: oFirstAvailEnd,
                dipIndex: iDipIdx,
                staffId: oDip.staffId,
                copies: 1
            });

            this.byId("duplicateAppointmentDialog").open();
        },

        onDupTypeChange: function (oEvent) {
            const sKey = oEvent.getSource().getSelectedKey();
            const aTipi = this.getView().getModel("ruoliModel").getProperty("/TipiTurno");
            const oTipo = aTipi.find(function (t) { return t.key === sKey; });
            if (!oTipo) return;
            const oDupModel = this.getView().getModel("dupAppt");
            oDupModel.setProperty("/color", oTipo.color);
            oDupModel.setProperty("/shiftIcon", oTipo.shiftIcon);
            oDupModel.setProperty("/title", oTipo.title);
        },

        onSaveDuplicateAppointment: function () {
            const oDupModel = this.getView().getModel("dupAppt");
            const sType = oDupModel.getProperty("/type");
            const iDipIdx = oDupModel.getProperty("/dipIndex");
            const sStaffId = oDupModel.getProperty("/staffId");
            const nCopies = parseInt(oDupModel.getProperty("/copies")) || 1;

            const aTipi = this.getView().getModel("ruoliModel").getProperty("/TipiTurno");
            const oTipo = aTipi.find(function (t) { return t.key === sType; }) || {};
            const sColor = oTipo.color || oDupModel.getProperty("/color") || "";
            const sShiftIcon = oTipo.shiftIcon || oDupModel.getProperty("/shiftIcon") || "";
            const sTitle = oTipo.title || oDupModel.getProperty("/title") || "";

            const oStart = this.byId("dupStartPicker").getDateValue();
            const oEnd = this.byId("dupEndPicker").getDateValue();

            if (!sType) {
                MessageToast.show("Seleziona un tipo di turno");
                return;
            }
            if (!oStart || !oEnd) {
                MessageToast.show("Inserisci date valide");
                return;
            }

            const iDuration = oEnd.getTime() - oStart.getTime();

            // Raccoglie i giorni già occupati
            const oModel = this.getView().getModel();
            const aShifts = oModel.getProperty("/dipendenti/" + iDipIdx + "/shifts") || [];
            const oOccupied = new Set(aShifts.map(function (s) {
                const d = s.startDate instanceof Date ? s.startDate : new Date(s.startDate);
                return d.toDateString();
            }));

            // Trova le prime N date disponibili a partire da oStart (già prima data libera)
            const aAvailableDates = [];
            const oCandidate = new Date(oStart);

            while (aAvailableDates.length < nCopies) {
                if (!oOccupied.has(oCandidate.toDateString())) {
                    aAvailableDates.push(new Date(oCandidate));
                    oOccupied.add(oCandidate.toDateString());
                }
                oCandidate.setDate(oCandidate.getDate() + 1);
            }

            const aPromises = aAvailableDates.map(function (oDate) {
                const oCopyStart = new Date(oDate);
                oCopyStart.setHours(oStart.getHours(), oStart.getMinutes(), 0, 0);
                const oCopyEnd = new Date(oCopyStart.getTime() + iDuration);

                return fetch("/odata/V4/catalog/appointments", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        ID_Utente: sStaffId,
                        type: sType,
                        title: sTitle,
                        color: sColor,
                        shiftIcon: sShiftIcon,
                        startDate: this._toLocalISO(oCopyStart),
                        endDate: this._toLocalISO(oCopyEnd)
                    })
                }).then(function (oRes) {
                    if (!oRes.ok) throw new Error("POST fallito: " + oRes.status);
                    if (oRes.status === 204) return { ID: "", _start: oCopyStart, _end: oCopyEnd };
                    return oRes.json().then(function (d) {
                        d._start = oCopyStart;
                        d._end = oCopyEnd;
                        return d;
                    });
                });
            }.bind(this));

            Promise.all(aPromises).then(function (aResults) {
                const aShiftsNow = oModel.getProperty("/dipendenti/" + iDipIdx + "/shifts");
                aResults.forEach(function (oData) {
                    aShiftsNow.push({
                        id: oData.ID || "",
                        startDate: oData._start,
                        endDate: oData._end,
                        title: sTitle,
                        type: sType,
                        shiftIcon: sShiftIcon,
                        color: sColor
                    });
                });
                oModel.setProperty("/dipendenti/" + iDipIdx + "/shifts", aShiftsNow);
                oModel.refresh(true);
                this.onAfterModifyData();
                MessageToast.show(nCopies + " turno/i duplicato/i con successo");
            }.bind(this)).catch(function (oErr) {
                MessageToast.show("Errore duplicazione: " + oErr.message);
            });

            this.byId("duplicateAppointmentDialog").close();
        },

        onCancelDuplicateAppointment: function () {
            this.byId("duplicateAppointmentDialog").close();
        },

        // Apre il dialog di creazione quando si clicca su un intervallo vuoto
        onIntervalSelect: function (oEvent) {
            const oStartDate = oEvent.getParameter("startDate");
            const oEndDate = oEvent.getParameter("endDate");
            const oCalendarRow = oEvent.getParameter("row");

            const aRows = this.byId("planningCalendar").getRows();
            const iTargetIdx = aRows.indexOf(oCalendarRow);
            if (iTargetIdx === -1) return;

            const oDip = this.getView().getModel().getProperty("/dipendenti/" + iTargetIdx);
            this.getView().getModel("newAppt").setData({
                type: "",
                color: "",
                shiftIcon: "",
                title: "",
                startDate: oStartDate,
                endDate: oEndDate,
                dipIndex: iTargetIdx,
                staffId: oDip.staffId
            });

            this.byId("createAppointmentDialog").open();
        },

        // Quando si cambia tipo nel Select del dialog di creazione
        onNewTypeChange: function (oEvent) {
            const sKey = oEvent.getSource().getSelectedKey();
            const aTipi = this.getView().getModel("ruoliModel").getProperty("/TipiTurno");
            const oTipo = aTipi.find(function (t) { return t.key === sKey; });
            if (!oTipo) return;

            const oNewModel = this.getView().getModel("newAppt");
            oNewModel.setProperty("/color", oTipo.color);
            oNewModel.setProperty("/shiftIcon", oTipo.shiftIcon);
            oNewModel.setProperty("/title", oTipo.title);
        },

        onSaveNewAppointment: function () {
            const oNewModel = this.getView().getModel("newAppt");
            const sType = oNewModel.getProperty("/type");
            const iDipIdx = oNewModel.getProperty("/dipIndex");
            const sStaffId = oNewModel.getProperty("/staffId");

            // Ricava sempre icona/colore/titolo dalla mappa TipiTurno (fonte di verità)
            const aTipi = this.getView().getModel("ruoliModel").getProperty("/TipiTurno");
            const oTipo = aTipi.find(function (t) { return t.key === sType; }) || {};
            const sColor = oTipo.color || oNewModel.getProperty("/color") || "";
            const sShiftIcon = oTipo.shiftIcon || oNewModel.getProperty("/shiftIcon") || "";
            const sTitle = oTipo.title || oNewModel.getProperty("/title") || "";

            const oStart = this.byId("newStartPicker").getDateValue();
            const oEnd = this.byId("newEndPicker").getDateValue();

            if (!sType) {
                MessageToast.show("Seleziona un tipo di turno");
                return;
            }
            if (!oStart || !oEnd) {
                MessageToast.show("Inserisci date valide");
                return;
            }

            // Controlla se esiste già un appuntamento nello stesso giorno
            const oModel = this.getView().getModel();
            const aExistingShifts = oModel.getProperty("/dipendenti/" + iDipIdx + "/shifts") || [];
            const sStartDay = oStart.toDateString();
            const bConflict = aExistingShifts.some(function (oShift) {
                const oShiftDate = oShift.startDate instanceof Date ? oShift.startDate : new Date(oShift.startDate);
                return oShiftDate.toDateString() === sStartDay;
            });
            if (bConflict) {
                MessageToast.show("Esiste già un turno in questo giorno");
                return;
            }

            fetch("/odata/V4/catalog/appointments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ID_Utente: sStaffId,
                    type: sType,
                    title: sTitle,
                    color: sColor,
                    shiftIcon: sShiftIcon,
                    startDate: this._toLocalISO(oStart),
                    endDate: this._toLocalISO(oEnd)
                })
            }).then(function (oRes) {
                if (!oRes.ok) throw new Error("POST fallito: " + oRes.status);
                // CAP può rispondere 201 con body oppure 204 senza body
                return oRes.status === 204 ? null : oRes.json();
            }).then(function (oData) {
                const sNewId = oData ? (oData.ID || "") : "";
                const aShifts = oModel.getProperty("/dipendenti/" + iDipIdx + "/shifts");
                aShifts.push({
                    id: sNewId,
                    startDate: oStart,
                    endDate: oEnd,
                    title: sTitle,
                    type: sType,
                    shiftIcon: sShiftIcon,
                    color: sColor
                });
                oModel.setProperty("/dipendenti/" + iDipIdx + "/shifts", aShifts);
                oModel.refresh(true);
                MessageToast.show("Turno creato");
            }.bind(this)).catch(function (oErr) {
                MessageToast.show("Errore creazione: " + oErr.message);
            });

            this.byId("createAppointmentDialog").close();
            this.onAfterModifyData();
        },

        onCancelNewAppointment: function () {
            this.byId("createAppointmentDialog").close();
        },

        // Apre il dialog di creazione quando si clicca su un intervallo vuoto
        onIntervalSelect: function (oEvent) {
            const oStartDate = oEvent.getParameter("startDate");
            const oEndDate = oEvent.getParameter("endDate");
            const oCalendarRow = oEvent.getParameter("row");

            const aRows = this.byId("planningCalendar").getRows();
            const iTargetIdx = aRows.indexOf(oCalendarRow);
            if (iTargetIdx === -1) return;

            const oDip = this.getView().getModel().getProperty("/dipendenti/" + iTargetIdx);
            this.getView().getModel("newAppt").setData({
                type: "",
                color: "",
                shiftIcon: "",
                title: "",
                startDate: oStartDate,
                endDate: oEndDate,
                dipIndex: iTargetIdx,
                staffId: oDip.staffId
            });

            this.byId("createAppointmentDialog").open();
        },

        // Quando si cambia tipo nel Select del dialog di creazione
        onNewTypeChange: function (oEvent) {
            const sKey = oEvent.getSource().getSelectedKey();
            const aTipi = this.getView().getModel("ruoliModel").getProperty("/TipiTurno");
            const oTipo = aTipi.find(function (t) { return t.key === sKey; });
            if (!oTipo) return;

            const oNewModel = this.getView().getModel("newAppt");
            oNewModel.setProperty("/color", oTipo.color);
            oNewModel.setProperty("/shiftIcon", oTipo.shiftIcon);
            oNewModel.setProperty("/title", oTipo.title);
        },

        onSaveNewAppointment: function () {
            const oNewModel = this.getView().getModel("newAppt");
            const sType = oNewModel.getProperty("/type");
            const iDipIdx = oNewModel.getProperty("/dipIndex");
            const sStaffId = oNewModel.getProperty("/staffId");

            // Ricava sempre icona/colore/titolo dalla mappa TipiTurno (fonte di verità)
            const aTipi = this.getView().getModel("ruoliModel").getProperty("/TipiTurno");
            const oTipo = aTipi.find(function (t) { return t.key === sType; }) || {};
            const sColor = oTipo.color || oNewModel.getProperty("/color") || "";
            const sShiftIcon = oTipo.shiftIcon || oNewModel.getProperty("/shiftIcon") || "";
            const sTitle = oTipo.title || oNewModel.getProperty("/title") || "";

            const oStart = this.byId("newStartPicker").getDateValue();
            const oEnd = this.byId("newEndPicker").getDateValue();

            if (!sType) {
                MessageToast.show("Seleziona un tipo di turno");
                return;
            }
            if (!oStart || !oEnd) {
                MessageToast.show("Inserisci date valide");
                return;
            }

            // Controlla se esiste già un appuntamento nello stesso giorno
            const oModel = this.getView().getModel();
            const aExistingShifts = oModel.getProperty("/dipendenti/" + iDipIdx + "/shifts") || [];
            const sStartDay = oStart.toDateString();
            const bConflict = aExistingShifts.some(function (oShift) {
                const oShiftDate = oShift.startDate instanceof Date ? oShift.startDate : new Date(oShift.startDate);
                return oShiftDate.toDateString() === sStartDay;
            });
            if (bConflict) {
                MessageToast.show("Esiste già un turno in questo giorno");
                return;
            }

            fetch("/odata/V4/catalog/appointments", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ID_Utente: sStaffId,
                    type: sType,
                    title: sTitle,
                    color: sColor,
                    shiftIcon: sShiftIcon,
                    startDate: this._toLocalISO(oStart),
                    endDate: this._toLocalISO(oEnd)
                })
            }).then(function (oRes) {
                if (!oRes.ok) throw new Error("POST fallito: " + oRes.status);
                // CAP può rispondere 201 con body oppure 204 senza body
                return oRes.status === 204 ? null : oRes.json();
            }).then(function (oData) {
                const sNewId = oData ? (oData.ID || "") : "";
                const aShifts = oModel.getProperty("/dipendenti/" + iDipIdx + "/shifts");
                aShifts.push({
                    id: sNewId,
                    startDate: oStart,
                    endDate: oEnd,
                    title: sTitle,
                    type: sType,
                    shiftIcon: sShiftIcon,
                    color: sColor
                });
                oModel.setProperty("/dipendenti/" + iDipIdx + "/shifts", aShifts);

                this.onAfterModifyData();

                oModel.refresh(true);
                MessageToast.show("Turno creato");
            }.bind(this)).catch(function (oErr) {
                MessageToast.show("Errore creazione: " + oErr.message);
            });

            this.byId("createAppointmentDialog").close();


        },

        onCancelNewAppointment: function () {
            this.byId("createAppointmentDialog").close();
        },

        onSearch: function () {
            const oCalendar = this.byId("planningCalendar");
            const oBinding = oCalendar.getBinding("rows");
            const aFiltri = [];

            const sRuolo = this.byId("roleFilterCombo").getSelectedKey();
            const sTeam = this.byId("groupFilter").getSelectedKey(); 
            const sRepartoAttivita = this.byId("repartoFilterCombo").getSelectedKey(); 

            // 1. Filtro Ruolo
            if (sRuolo) {
                aFiltri.push(new Filter("role", FilterOperator.EQ, sRuolo));
            }
            if (sTeam){
                aFiltri.push(new Filter("teamName",FilterOperator.EQ,sTeam));
            }
            if (sRepartoAttivita) {
                aFiltri.push(new Filter({
                    path: "shifts",
                    test: function (aShifts) {
                        if (!aShifts) return false;
                        return aShifts.some(s => s.type === sRepartoAttivita);
                    }
                }));
            }

            if (oBinding) {
                oBinding.filter(aFiltri);
                MessageToast.show("Filtri applicati");
            }
        },
        onResetFilters: function () {
            // 1. Pulizia fisica dei campi con ID corretti
            this.byId("roleFilterCombo").setSelectedKey("");
            this.byId("groupFilter").setSelectedKey("");
            this.byId("repartoFilterCombo").setSelectedKey("");

            // 2. Rilascio dei filtri sul calendario
            const oBinding = this.byId("planningCalendar").getBinding("rows");
            if (oBinding) {
                oBinding.filter([]);
            }
            MessageToast.show("Filtri resettati");
        },
        onPressMancanzaPersonale: function () {
            const oKpiModel = this.getView().getModel("kpi");
            const bActive = oKpiModel.getProperty("/showUnderstaffingHighlight");
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

        GGMMAA: function () {
            const oCalendar = this.byId("planningCalendar");
            const oStartDate = oCalendar?.getStartDate() || new Date();

            const iYear = oStartDate.getFullYear();
            const iMonth = oStartDate.getMonth();
            const iDaysInMonth = new Date(iYear, iMonth + 1, 0).getDate();

            return { iYear, iMonth, iDaysInMonth };
        },

        /////// funzione da chiamare all'interno di kpiCountDay-


        updateUnderstaffing: function (bUpdateCalendar) { //// true oppure false
            const oModel = this.getView().getModel(); // modello default (no nome)
            const oKpiModel = this.getView().getModel("kpi");
            const oCalendar = this.byId("planningCalendar");

            const aStaff = oModel?.getProperty("/dipendenti") || [];


            const { iYear, iMonth, iDaysInMonth } = this.GGMMAA();

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
        /////// non più di x giorni consecutivi.


        onPressRischioSalute: function (bIsRefreshOnly) {
            const oKpiModel = this.getView().getModel("kpi");
            let bNewActive;

            if (bIsRefreshOnly === true) {

                bNewActive = oKpiModel.getProperty("/showConsecutiveHighlight");
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


        countConsecutive: function (bShouldHighlight) {

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

        onPressMancazaRiposso: function (bIsRefreshOnly) {
            const oKpiModel = this.getView().getModel("kpi");
            let bNewActive;

            if (bIsRefreshOnly === true) {  ///// se modifica nel planning calendar direttamente. 
                bNewActive = oKpiModel.getProperty("/showRestHighlight");
            } else {
                const bCurrentlyActive = oKpiModel.getProperty("/showRestHighlight") || false;
                bNewActive = !bCurrentlyActive;
                oKpiModel.setProperty("/showRestHighlight", bNewActive);
            }

            this.countNonroposoSettimanale(bNewActive);
        },

        countNonroposoSettimanale: function (bShouldHighlight) {
            const oModel = this.getView().getModel();
            const oKpiModel = this.getView().getModel("kpi");
            const oCalendar = this.byId("planningCalendar");

            const { iYear, iMonth, iDaysInMonth } = this.GGMMAA();

            let iTotalViolatingPeople = 0;
            const aStaff = oModel.getProperty("/dipendenti") || [];
            const aRows = oCalendar ? oCalendar.getRows() : [];

            aStaff.forEach((person, index) => {
                let bPersonViolates = false;
                let bFirstViolationFound = false; /////// per controllare se abbiamo trovato già la prima settimana fuori condizione.
                const oRow = aRows[index];


                if (oRow) {
                    oRow.destroySpecialDates();
                }

                const restDays = {};
                if (person.shifts) {
                    person.shifts.forEach(shift => {
                        if (shift.type === "RIPOSO" && shift.startDate) {
                            const sDate = new Date(shift.startDate).toDateString();
                            restDays[sDate] = true;
                        }
                    });
                }

                ////// trovare la prima settimana intera del mese --> il primo lunedì
                let iStartDay = 1;
                for (let i = 1; i <= 7; i++) {
                    let oTempDate = new Date(iYear, iMonth, i);
                    if (oTempDate.getDay() === 1) {
                        iStartDay = i;
                        break;
                    }
                }

                ///// controllare la condizione in base alla settimana. 
                for (let weekStart = iStartDay; weekStart + 6 <= iDaysInMonth; weekStart += 7) {
                    let bHaRiposatoInSettimana = false;
                    let aCurrentWeekDates = [];

                    for (let d = 0; d < 7; d++) {
                        let oCheckDate = new Date(iYear, iMonth, weekStart + d);
                        aCurrentWeekDates.push(new Date(oCheckDate));

                        if (restDays[oCheckDate.toDateString()]) {
                            bHaRiposatoInSettimana = true;
                        }
                    }

                    ////// fuori condizione ?
                    if (!bHaRiposatoInSettimana) {
                        bPersonViolates = true; ///// basta avere una settimana fuori condizione

                        ////// evidenziamo soltanto la prima settimana fuori condizione. 
                        if (bShouldHighlight && oRow && !bFirstViolationFound) {
                            aCurrentWeekDates.forEach(oDate => {
                                oRow.addSpecialDate(new DateTypeRange({
                                    startDate: oDate,
                                    type: "NonWorking"
                                }));
                            });
                            bFirstViolationFound = true;
                        }

                    }
                }

                person.highlight = bShouldHighlight && bPersonViolates;

                if (bPersonViolates) {
                    iTotalViolatingPeople++;
                }
            });

            oKpiModel.setProperty("/personaleSenzaMinimoRiposoCount", iTotalViolatingPeople);
            oKpiModel.setProperty("/restStatus", iTotalViolatingPeople > 0 ? "Error" : "Success");

            oModel.refresh(true);

            return iTotalViolatingPeople;
        },


        //////// per aggiornare kpi in: drag & drop(ok), delete(not ok) ...

        onAfterModifyData: function () {
            const oLocalModel = this.getView().getModel();

            oLocalModel.refresh(true);


            //// calcoli kpi
            this.countConsecutive(false);
            this.updateUnderstaffing();
            this.countNonroposoSettimanale(false);

            //// evidenzia kpi::
            this.onPressRischioSalute(true);
            this.onPressMancazaRiposso(true);
        },


    });
});
