import {Module, Mutation, VuexModule} from "vuex-module-decorators";
import {getScNbFuses, Scenario} from "@/ts/scenario";
import {Cable, ConfidenceLevel, Entity, EntityType, Fuse, Grid, Meter, oppositeState, State, ULoad} from "@/ts/grid";
import {Vue} from "vue-property-decorator";
import {CableJson, EntityJson, FuseJson, GridJson, LoadJson, MeterJson} from "@/types/sg-json.types";
import {GridData, json2Grid} from "@/utils/grid-utils";

export interface UpdateNumVal {
    id: number;
    newValue: number;
}

export interface DataNewEntity {
    id: number;
    type: EntityType;
}

export interface DataNewCable {
    id: number;
    entityId1: number;
    entityId2: number;
}

export interface DataConnCblMeter {
    meterId: number;
    cableId: number;
}


const NULL_GRID: Grid = new Grid(
    new Map<number, Cable>(),
    new Map<number, Fuse>(),
    new Map<number, Meter>()
);


function _getFuseState(state: GridState, id: number): State {
    const realId = (state.indexesUsed) ? state.fuseIdx.get(id) : id;
    if (realId !== undefined) {
        const status: State | undefined = state.fusesUStatusState[realId];
        return (status === undefined) ? State.CLOSED : status;
    }
    return State.CLOSED;
}





@Module({
    namespaced: true
})
export default class GridState extends VuexModule {
    public grid: Grid = NULL_GRID;

    public meterIdx = new Map<number, number>();
    public fuseIdx = new Map<number, number>();
    public cableIdx = new Map<number, number>();
    public indexesUsed = false;

    public metersCons = new Array<number>();
    public fusesUStatusState = new Array<State>();
    public fusesUStatusConf = new Array<ConfidenceLevel>();
    public fusesULoads = new Array<Array<ULoad>>();
    public cablesULoads = new Array<Array<ULoad>>();


    get fuseState() {
        return (id: number): State => {
            return _getFuseState(this, id);
        }
    }

    get fuseIsClosed() {
        return (id: number): boolean => {
            return _getFuseState(this, id) === State.CLOSED;
        }
    }

    get fuseULoads() {
        return (id: number): Array<ULoad>|undefined => {
            const realId = (this.indexesUsed)? this.fuseIdx.get(id) : id;
            if(realId !== undefined) {
                return this.fusesULoads[realId];
            } else {
                console.log("Silent error get fuseULoads()");
                return [];
            }
        }
    }

    get cableULoads() {
        return (id: number): Array<ULoad> => {
            const realId = (this.indexesUsed)? this.cableIdx.get(id) : id;
            if(realId !== undefined) {
                return this.cablesULoads[realId];
            } else {
                console.log("Silent error get cableULoads()");
                return [];
            }
        }
    }

    get fuseConfLevel() {
        return (id: number): number => {
            const realId = (this.indexesUsed)? this.fuseIdx.get(id) : id;
            if(realId !== undefined) {
                const conf: ConfidenceLevel|undefined = this.fusesUStatusConf[id];
                return (conf === undefined)? -1 : conf.level;
            } else {
                console.log("Silent error fuseCOnfLevel()");
                return -1;
            }
        }
    }

    get fuseConfLevelStr() {
        return (id: number): string => {
            const realId = (this.indexesUsed)? this.fuseIdx.get(id) : id;
            if(realId !== undefined) {
                const conf: ConfidenceLevel|undefined = this.fusesUStatusConf[id];
                return (conf === undefined)? "-1" : conf.prettyConf();
            } else {
                console.log("Silent error fuseCOnfLevel()");
                return "-1";
            }
        }
    }

    get meterCons() {
        return (id: number): number => {
            const realId = (this.indexesUsed)? this.meterIdx.get(id) : id;
            if(realId !== undefined) {
                const cons: number|undefined = this.metersCons[realId];
                return (cons === undefined)? 0. : cons;
            }
            console.log("Silent error meterCons");
            return -1;
        }
    }

    get meterName() {
        return (id: number): string => {
            return (this.grid.meters.get(id) as Meter).name;
        }
    }

    get meters() {
        return (cableId: number): Array<Meter> => {
            return (this.grid.cables.get(cableId) as Cable).meters;
        }
    }

    get gridJson() {
        const entities: EntityJson[] = new Array<EntityJson>();
        this.grid.entities?.forEach((entity: Entity) => {
            const jsonEnt: EntityJson = {
                name: entity.name,
                type: entity.type,
                fuses: entity.fuses.map((fuse: Fuse) => fuse.id)
            };
            if(entity.latitude !== undefined && entity.longitude !== undefined) {
                jsonEnt.location = {lat: entity.latitude, long: entity.longitude}
            }
            entities.push(jsonEnt);
        });

        const fuses: FuseJson[] = new Array<FuseJson>();
        this.grid.fuses.forEach((fuse: Fuse) => {
            const jsonFuse: FuseJson = {
                id: fuse.id,
                name: fuse.name,
                state: {status: this.fuseState(fuse.id), confidence: this.fuseConfLevel(fuse.id)},
            };
            const load = this.fuseULoads(fuse.id);
            if(load != undefined) {
                jsonFuse.load = new Array<LoadJson>();
                load.forEach((ul: ULoad) => {
                    jsonFuse.load?.push({
                        confidence: ul.confidence.level,
                        value: ul.load
                    })
                })
            }
            fuses.push(jsonFuse);
        });

        const cables: CableJson[] = new Array<CableJson>();
        this.grid.cables.forEach((cable: Cable) => {
            const cableJson: CableJson = {
                id: cable.id,
                fuses: [cable.fuse1.id, cable.fuse2.id]
            };

            cableJson.meters = cable.meters.map((meter: Meter) => {
                const json: MeterJson = {
                    name: meter.name,
                    consumption: this.meterCons(meter.id)
                };

                if(meter.latitude !== -1 && meter.longitude !== -1) {
                    json.location = {lat: meter.latitude, long: meter.longitude};
                }

                return json;
            });
            cables.push(cableJson);
        });

        return JSON.stringify({entities, fuses, cables}, undefined, 2)
    }

    @Mutation
    public initEmpty() {
        this.grid = NULL_GRID;

        this.meterIdx = new Map<number, number>();
        this.fuseIdx = new Map<number, number>();
        this.cableIdx = new Map<number, number>();
        this.indexesUsed = true;

        this.metersCons = new Array<number>();
        this.fusesUStatusState = new Array<State>();
        this.fusesUStatusConf = new Array<ConfidenceLevel>();
        this.fusesULoads = new Array<Array<ULoad>>();
        this.cablesULoads = new Array<Array<ULoad>>();
    }

    @Mutation
    public addEntity(data: DataNewEntity) {
        if(this.grid.entities === undefined) {
            this.grid.entities = new Map<number, Entity>();
        }
        this.grid.entities.set(data.id, new Entity(data.id, data.type, data.type + " " + data.id, new Array<Fuse>()));
    }

    @Mutation
    public addCable(data: DataNewCable) {
        let fuseId = this.fusesUStatusConf.length;
        const fuse1 = new Fuse(fuseId);
        this.grid.fuses.set(fuseId, fuse1);
        this.fusesUStatusConf.push(new ConfidenceLevel());
        this.fusesUStatusState.push(State.CLOSED);
        this.fuseIdx.set(fuseId, fuseId);

        fuseId = this.fusesUStatusConf.length;
        const fuse2 = new Fuse(fuseId);
        this.grid.fuses.set(fuseId, fuse2);
        this.fusesUStatusConf.push(new ConfidenceLevel());
        this.fusesUStatusState.push(State.CLOSED);
        this.fuseIdx.set(fuseId, fuseId);

        this.grid.cables.set(data.id, new Cable(data.id, fuse1, fuse2, "Cable"));
        this.cableIdx.set(data.id, this.cablesULoads.length);
        this.cablesULoads.push([]);

        const entity1 = this.grid.entities?.get(data.entityId1) as Entity;
        const entity2 = this.grid.entities?.get(data.entityId2) as Entity;

        entity1.fuses.push(fuse1);
        entity2.fuses.push(fuse2);

        console.log(this.grid.fuses);
    }

    @Mutation
    public addMeter(id: number) {
        const meter = new Meter(id);
        this.grid.meters.set(id, meter);
        this.meterIdx.set(id, this.metersCons.length);
        this.metersCons.push(0.);
    }

    @Mutation
    public connectMeter2Cable(data: DataConnCblMeter) {
        const cable = this.grid.cables.get(data.cableId) as Cable;
        const meter = this.grid.meters.get(data.meterId) as Meter;
        cable.meters.push(meter);
    }

    @Mutation
    public initFromScenario(scenario: Scenario) {
        this.metersCons = new Array<number>();
        this.fusesUStatusState = new Array<State>();
        this.fusesUStatusConf = new Array<ConfidenceLevel>();
        this.fusesULoads = new Array<Array<ULoad>>();
        this.cablesULoads = new Array<Array<ULoad>>();

        const nbFuses = getScNbFuses(scenario);

        const fuses = new Map<number, Fuse>();
        const cables = new Map<number, Cable>();
        const meters = new Map<number, Meter>();

        for (let i=0; i<nbFuses; i++) {
            fuses.set(i, new Fuse(i));
            this.fusesUStatusState.push(State.CLOSED);
            this.fusesUStatusConf.push(new ConfidenceLevel());
        }

        for (let i = 0; i < (nbFuses / 2); i++) {
            const fuse1 = fuses.get(i*2) as Fuse;
            const fuse2 = fuses.get(i*2 + 1) as Fuse;
            const cable= new Cable(i, fuse1, fuse2);
            cables.set(i, cable);

            const meter = new Meter(i);
            meters.set(i, meter);
            cable.meters.push(meter);

            this.metersCons.push(0.);
        }


        this.grid = new Grid(cables, fuses, meters);
        this.indexesUsed = false;
    }

    @Mutation
    public initFromJson(json: GridJson) {
        const data: GridData = json2Grid(json);

        this.grid = data.staticInfo;

        this.meterIdx = data.meterIdx;
        this.fuseIdx = data.fuseIdx;
        this.cableIdx = data.cableIdx;
        this.indexesUsed = true;

        this.metersCons = data.metersCons;
        this.fusesUStatusState = data.fusesStates;
        this.fusesUStatusConf = data.fusesConf;
        this.fusesULoads = data.fusesULoads;
        this.cablesULoads = data.cablesULoads;
    }

    @Mutation
    public updateConsumption(data: UpdateNumVal) {
        const id = (this.indexesUsed)? this.meterIdx.get(data.id): data.id;
        if(id !== undefined) {
            Vue.set(this.metersCons, id, data.newValue);
        } else {
            console.log("Silent error in updateConsumption");
        }
    }

    @Mutation
    public updateStateConf(data: UpdateNumVal) {
        const id = (this.indexesUsed)? this.fuseIdx.get(data.id): data.id;
        if(id !== undefined) {
            Vue.set(this.fusesUStatusConf, data.id, new ConfidenceLevel(data.newValue));
        } else {
            console.log("Silent error in updateStateConf");
        }
    }

    @Mutation
    public switchFuse(id: number) {
        const currState = _getFuseState(this, id);
        const realId = (this.indexesUsed)? this.fuseIdx.get(id): id;
        if(realId !== undefined) {
            Vue.set(this.fusesUStatusState, realId, oppositeState(currState));
        } else {
            console.log("Silent error in switchFuse");
        }
    }
}

