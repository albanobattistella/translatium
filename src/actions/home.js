import {
  UPDATE_INPUT_TEXT, UPDATE_OUTPUT, UPDATE_IME_MODE, TOGGLE_FULLSCREEN_INPUT_BOX,
} from '../constants/actions';

import translateText from '../libs/translate-text';
import phrasebookDb from '../libs/phrasebook-db';

import { openAlert } from './alert';
import { updateSetting } from './settings';
import { addHistoryItem } from './history';

export const toggleFullscreenInputBox = () => ({
  type: TOGGLE_FULLSCREEN_INPUT_BOX,
});

export const translate = saveToHistory => ((dispatch, getState) => {
  const { settings, home } = getState();
  const { inputLang, outputLang, chinaMode } = settings;
  const { inputText, fullscreenInputBox } = home;

  // Safe
  if (inputText.trim().length < 1) return;

  const identifier = Date.now();

  if (fullscreenInputBox === true) {
    dispatch(toggleFullscreenInputBox());
  }

  dispatch({
    type: UPDATE_OUTPUT,
    output: {
      status: 'loading',
      identifier,
    },
  });

  translateText(inputLang, outputLang, inputText, chinaMode)
    .then((result) => {
      // Prevent slow request to display outdated info
      const currentOutput = getState().home.output;
      if (currentOutput && currentOutput.identifier === identifier) {
        const r = result;
        r.status = 'done';
        r.inputLang = inputLang;
        r.outputLang = outputLang;
        r.inputText = inputText;

        if (saveToHistory === true) {
          dispatch(addHistoryItem(r));
        }

        dispatch({
          type: UPDATE_OUTPUT,
          output: r,
        });
      }
    })
    .catch(() => {
      // Prevent slow request to display outdated info
      const currentOutput = getState().home.output;
      if (currentOutput && currentOutput.identifier === identifier) {
        dispatch(openAlert('cannotConnectToServer'));

        dispatch({
          type: UPDATE_OUTPUT,
          output: null,
        });
      }
    });
});

export const updateInputText = (inputText, selectionStart, selectionEnd) =>
  ((dispatch, getState) => {
    const { settings, home } = getState();
    const realtime = settings.realtime;
    const currentInputText = home.inputText;
    const fullscreenInputBox = home.fullscreenInputBox;

    dispatch({ type: UPDATE_INPUT_TEXT, inputText, selectionStart, selectionEnd });

    // No change in inputText, no need to re-run task
    if (currentInputText === inputText) return;

    if (realtime === true && fullscreenInputBox === false && inputText.trim().length > 0) {
      // delay to save bandwidth
      const tmpHome = getState().home;
      setTimeout(() => {
        if (getState().home.inputText !== inputText) return;
        dispatch(translate());
      }, tmpHome.output ? 300 : 0);
    } else {
      dispatch({
        type: UPDATE_OUTPUT,
        output: null,
      });
    }
  });

export const togglePhrasebook = () => ((dispatch, getState) => {
  const { output } = getState().home;

  const phrasebookId = output.phrasebookId;

  if (phrasebookId) {
    phrasebookDb.get(phrasebookId)
      .then(doc => phrasebookDb.remove(doc))
      .then(() => {
        const newOutput = Object.assign({}, output, { phrasebookId: null });

        dispatch({
          type: UPDATE_OUTPUT,
          output: newOutput,
        });
      });
  } else {
    const newPhrasebookId = new Date().toJSON();
    phrasebookDb.put({
      _id: newPhrasebookId,
      data: output,
      phrasebookVersion: 3,
    })
    .then(() => {
      dispatch({
        type: UPDATE_OUTPUT,
        output: Object.assign({}, output, { phrasebookId: newPhrasebookId }),
      });
    });
  }
});

export const loadOutput = output => ((dispatch) => {
  // First load output
  dispatch({
    type: UPDATE_OUTPUT,
    output,
  });

  // Update inputLang, outputLang, inputText without running anything;
  dispatch(updateSetting('inputLang', output.inputLang));
  dispatch(updateSetting('outputLang', output.outputLang));
  dispatch({
    type: UPDATE_INPUT_TEXT,
    inputText: output.inputText,
    selectionStart: 0,
    selectionEnd: 0,
  });
});

export const updateImeMode = imeMode => ({
  type: UPDATE_IME_MODE,
  imeMode,
});
