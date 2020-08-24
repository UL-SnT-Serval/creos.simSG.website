import Vue from 'vue'
import Vuex from 'vuex'
import ToolBarState from "@/store/modules/sc-viewer/toolbar";
import GridSCState from "@/store/modules/sc-viewer/grid";
import InspectorState from "@/store/modules/inspector";
import TestState from "@/store/modules/testStore"

Vue.use(Vuex);

export default new Vuex.Store({
  state: {
  },
  mutations: {
  },
  actions: {
  },
  modules: {
    ToolBarState, GridSCState, InspectorState, TestState
  }
})
