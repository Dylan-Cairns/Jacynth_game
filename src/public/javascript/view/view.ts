import { BoardSpace, GameBoard } from '../model/gameboard.js';
import { Card } from '../model/decktet.js';
import { PlayerID } from '../model/player.js';

export class View {
  app: Element;
  gameBoard: HTMLElement;
  playerHandContainer: HTMLElement;
  influenceTokenContainer: HTMLElement;
  undoButton: HTMLButtonElement;
  endTurnButton: HTMLButtonElement;
  player1HUD: HTMLElement;
  player2HUD: HTMLElement;
  player1Icon: HTMLElement;
  player2Icon: HTMLElement;
  pickupSound: HTMLMediaElement;
  dropSound: HTMLMediaElement;
  clickSound: HTMLMediaElement;
  draggedElement: HTMLElement | undefined;
  undoMovesArr: {
    draggedEle: HTMLElement;
    targetSpace: HTMLElement;
  }[];
  getAvailCardSpaces: (() => BoardSpace[]) | undefined;
  getAvailTokenSpaces: (() => BoardSpace[]) | undefined;
  sendCardPlayToModel:
    | ((cardID: string, spaceID: string) => boolean)
    | undefined;
  sendTokenPlayToModel: ((spaceID: string) => boolean) | undefined;
  undoPlayCard: ((spaceID: string) => void) | undefined;
  undoPlaceToken: ((spaceID: string) => void) | undefined;
  computerTakeTurn: (() => void) | undefined;
  getCardDrawFromModel: (() => void) | undefined;
  getP1AvailableTokensNumber: (() => number) | undefined;
  getP2AvailableTokensNumber: (() => number) | undefined;
  getPlayer1Score: (() => void) | undefined;
  getPlayer2Score: (() => void) | undefined;

  constructor(board: GameBoard) {
    this.app = document.querySelector('#root')! as HTMLElement;
    this.gameBoard = document.querySelector('.gameboard')! as HTMLElement;
    this.playerHandContainer = document.querySelector(
      '.player-hand'
    )! as HTMLElement;
    this.influenceTokenContainer = document.querySelector(
      '.influenceTokenContainer'
    )!;
    this.undoButton = document.getElementById(
      'undoButton'
    ) as HTMLButtonElement;
    this.undoButton.disabled = true;
    this.endTurnButton = document.getElementById(
      'endTurnButton'
    ) as HTMLButtonElement;
    this.endTurnButton.disabled = true;
    this.player1Icon = document.getElementById('player1Icon') as HTMLElement;
    this.player2Icon = document.getElementById('player2Icon') as HTMLElement;
    this.player1HUD = document.getElementById('player1HUD') as HTMLElement;
    this.player2HUD = document.getElementById('player2HUD') as HTMLElement;
    this.pickupSound = document.getElementById(
      'pickupSound'
    ) as HTMLMediaElement;
    this.clickSound = document.getElementById('clickSound') as HTMLMediaElement;
    this.dropSound = document.getElementById('dropSound') as HTMLMediaElement;
    this.undoMovesArr = [];
    this.createBoardSpaces(board);
    // create initial influence token
    const token = this.createElement('div', 'influenceToken', 'player1Token');
    this.influenceTokenContainer.appendChild(token);

    // on dragstart, get all available spaces from the model
    document.addEventListener('dragstart', (event) => {
      this.pickupSound.play();
      this.draggedElement = event.target as HTMLElement;
      if (this.draggedElement.classList.contains('card')) {
        if (this.getAvailCardSpaces) {
          this.highlightAvailableSpaces(this.getAvailCardSpaces);
        }
      } else if (this.draggedElement.classList.contains('influenceToken')) {
        if (this.getAvailTokenSpaces) {
          this.highlightAvailableSpaces(this.getAvailTokenSpaces);
        }
      }
    });

    document.addEventListener(
      'dragover',
      function (event) {
        // prevent default to allow drop
        event.preventDefault();
      },
      false
    );

    document.addEventListener(
      'dragenter',
      function (event) {
        // highlight potential drop target when the draggable element enters it
        const targetSpace = event.target as HTMLInputElement;
        if (targetSpace.classList) {
          targetSpace.classList.add('dragenter');
        }
      },
      false
    );

    document.addEventListener(
      'dragleave',
      function (event) {
        // remove highlighting
        const targetSpace = event.target as HTMLInputElement;
        if (targetSpace.classList) {
          targetSpace.classList.remove('dragenter');
        }
      },
      false
    );

    document.addEventListener('drop', (event) => {
      event.preventDefault();
      const targetSpace = event.target as HTMLInputElement;
      targetSpace.classList.remove('dragenter');
      // check space is playable & required attributes are defined
      if (
        targetSpace.classList.contains('playable-space') &&
        this.draggedElement &&
        this.draggedElement.parentNode &&
        targetSpace
      ) {
        this.dropSound.play();
        // if dragged item is a card, place the card,
        // disable dragging of remaining cards and enable dragging token,
        // and invoke playcard callback to trigger change in model
        if (this.draggedElement.classList.contains('card')) {
          this.disableAllCardDragging();
          this.enableTokenDragging();

          this.draggedElement.parentNode.removeChild(this.draggedElement);
          targetSpace.appendChild(this.draggedElement);
          if (this.sendCardPlayToModel) {
            this.sendCardPlayToModel(targetSpace.id, this.draggedElement.id);
          }
          // save move information for undo
          this.undoMovesArr.push({
            draggedEle: this.draggedElement,
            targetSpace: targetSpace
          });
          //enable undo button
          this.undoButton.disabled = false;
          // play can end turn after placing a card
          this.endTurnButton.disabled = false;
          // or place a token
        } else if (this.draggedElement.classList.contains('influenceToken')) {
          this.draggedElement.parentNode.removeChild(this.draggedElement);
          targetSpace.appendChild(this.draggedElement);
          this.disableAllTokenDragging();
          if (this.sendTokenPlayToModel) {
            this.sendTokenPlayToModel(targetSpace.id);
          }
          // save move information for undo
          this.undoMovesArr.push({
            draggedEle: this.draggedElement,
            targetSpace: targetSpace
          });
          this.undoButton.disabled = false;
        }
      }
    });

    document.addEventListener('dragend', () => {
      // remove all available spaces highlighting
      Array.from(this.gameBoard.children).forEach((space) => {
        space.classList.remove('playable-space');
      });
    });

    this.undoButton.addEventListener('click', () => {
      this.pickupSound.play();
      if (this.undoMovesArr.length > 0) {
        const moveObj = this.undoMovesArr.pop()!;
        const cardOrTokenToUndo = moveObj.draggedEle;
        const targetSpace = moveObj.targetSpace;
        // if first item in undo list is card,
        // replace the card, invoke the model to reset board control,
        // re-enable card dragging, disable token dragging
        // & disable the undo button
        if (cardOrTokenToUndo.classList.contains('card')) {
          targetSpace.removeChild(cardOrTokenToUndo);
          this.playerHandContainer.appendChild(cardOrTokenToUndo);
          if (this.undoPlayCard) {
            this.undoPlayCard(targetSpace.id);
          }
          this.enableCardHandDragging();
          this.disableAllTokenDragging();
          this.undoButton.disabled = true;
          this.endTurnButton.disabled = true;
          // if it's a token, leave undo button active.
        } else if (cardOrTokenToUndo?.classList.contains('influenceToken')) {
          targetSpace.removeChild(cardOrTokenToUndo);
          this.influenceTokenContainer.appendChild(cardOrTokenToUndo);
          if (this.undoPlaceToken) {
            this.undoPlaceToken(targetSpace.id);
          }
          this.enableTokenDragging();
        }
      }
    });

    this.endTurnButton.addEventListener('click', () => {
      this.clickSound.play();
      if (this.computerTakeTurn) {
        this.computerTakeTurn();
      }
      if (this.getCardDrawFromModel) {
        this.getCardDrawFromModel();
      }
      this.addInfluenceTokenToHand();
      this.enableCardHandDragging();
      this.disableAllTokenDragging();
      this.undoButton.disabled = true;
      this.endTurnButton.disabled = true;
      this.updateHUD();
    });
  }

  createElement(tag: string, ...classNames: string[]) {
    const element = document.createElement(tag);
    if (classNames) element.classList.add(...classNames);

    return element;
  }

  createBoardSpaces(board: GameBoard) {
    const spacesMap = board.getAllSpaces();
    const dimensions = board.getBoardSize();
    let isDark = false;
    const isBoardWidthEven = dimensions % 2 === 0;

    spacesMap.forEach((spaceObj) => {
      const spaceDiv = document.createElement('div');
      const spaceID = spaceObj.getID();
      const x = Number(spaceID[1]);
      const y = Number(spaceID[3]);
      spaceDiv.classList.add('boardSpace');
      spaceDiv.id = spaceID;
      // if board width is even, swap color of starting tile for each new row
      if (isBoardWidthEven) {
        if (x === 0 && y > 0) {
          isDark = !isDark;
        }
      }
      // alternate dark and light tiles of the board
      if (isDark) {
        spaceDiv.classList.add('dark-square');
        isDark = false;
      } else {
        isDark = true;
      }
      this.gameBoard.appendChild(spaceDiv);
    });
  }

  private createCard = (card: Card) => {
    // get the values from the card
    const id = card.getId();
    const suits = card.getAllSuits();
    const cardComponents = [] as Element[];
    const value = card.getValue();
    // create the card
    const cardDiv = this.createElement('div', 'card');
    cardDiv.id = id;
    // create and append the children
    const valueDiv = this.createElement('div', `card-cell`);
    valueDiv.textContent = this.prepareValueForDisplay(value);
    suits.forEach((suit) => {
      cardComponents.push(this.createElement('div', 'card-cell', suit));
    });
    if (suits.length < 2) {
      const placeHolderDiv = this.createElement('div', `card-cell`);
      cardComponents.push(placeHolderDiv);
    }
    cardComponents.push(valueDiv);
    cardComponents.forEach((ele) => {
      cardDiv.appendChild(ele);
    });
    return cardDiv;
  };

  private updateHUD() {
    if (
      this.getPlayer1Score &&
      this.getPlayer2Score &&
      this.getP1AvailableTokensNumber &&
      this.getP2AvailableTokensNumber
    ) {
      const p1Score = this.getPlayer1Score();
      const p2Score = this.getPlayer2Score();
      const p1Tokens = this.getP1AvailableTokensNumber();
      const p2Tokens = this.getP2AvailableTokensNumber();
      this.player1HUD.textContent = `Score ${p1Score} Tokens ${p1Tokens}`;
      this.player2HUD.textContent = `Score ${p2Score} Tokens ${p2Tokens}`;

      if (p1Score > p2Score) {
        this.player1Icon.classList.remove('losing');
        this.player1Icon.classList.add('winning');
        this.player2Icon.classList.remove('winning');
        this.player2Icon.classList.add('losing');
      } else if (p1Score < p2Score) {
        this.player2Icon.classList.remove('losing');
        this.player2Icon.classList.add('winning');
        this.player1Icon.classList.remove('winning');
        this.player1Icon.classList.add('losing');
      }
    }
  }

  private addInfluenceTokenToHand() {
    // if there's already a token in hand, return
    if (this.influenceTokenContainer.querySelector('.influenceToken')) {
      return;
    }
    if (this.getP1AvailableTokensNumber) {
      if (this.getP1AvailableTokensNumber() > 0) {
        const token = this.createElement(
          'div',
          'influenceToken',
          'player1Token'
        );
        this.influenceTokenContainer.appendChild(token);
      }
    }
  }

  private enableCardHandDragging() {
    const CardsArr = Array.from(
      this.playerHandContainer.querySelectorAll('.card')
    ) as HTMLElement[];
    CardsArr.forEach((ele) => {
      if (ele.classList.contains('card')) {
        ele.draggable = true;
      }
    });
  }

  private disableAllCardDragging() {
    const CardsArr = Array.from(
      document.querySelectorAll('.card')
    ) as HTMLElement[];
    CardsArr.forEach((ele) => {
      if (ele.classList.contains('card') && ele.draggable) {
        ele.draggable = false;
      }
    });
  }

  private enableTokenDragging() {
    const token = this.influenceTokenContainer.firstChild as HTMLElement;
    if (token) {
      token.draggable = true;
    }
  }

  private disableAllTokenDragging() {
    const tokenArr = Array.from(
      document.querySelectorAll('.influenceToken')
    ) as HTMLElement[];
    tokenArr.forEach((ele) => {
      if (ele.classList.contains('influenceToken') && ele.draggable) {
        ele.draggable = false;
      }
    });
  }

  private addCardToSpace = (cardDiv: HTMLElement, spaceID: string) => {
    const boardSpace = document.getElementById(spaceID);
    boardSpace?.appendChild(cardDiv);
  };

  private highlightAvailableSpaces = (
    getAvailableSpacesCallback: () => BoardSpace[]
  ) => {
    const availableSpaces = getAvailableSpacesCallback();
    availableSpaces.forEach((space) => {
      const spaceID = space.getID();
      const availableSpace = document.getElementById(spaceID);
      if (availableSpace) {
        availableSpace.classList.add('playable-space');
      }
    });
  };

  private prepareValueForDisplay(value: number) {
    switch (value) {
      case 0:
        return '.';
      case 1:
        return '1';
      case 10:
        return '*';
      case 11:
        return '#';
      case 12:
        return '%%';
      default:
        return String(value);
    }
  }

  playerDrawCardCB = (card: Card) => {
    const cardDiv = this.createCard(card);
    cardDiv.draggable = true;
    this.playerHandContainer?.appendChild(cardDiv);
  };

  nonPlayerCardPlacementCB = (card: Card, boardSpace: BoardSpace) => {
    const cardDiv = this.createCard(card);
    cardDiv.classList.add('roll-in-top');
    this.addCardToSpace(cardDiv, boardSpace.getID());
  };

  nonPlayerTokenPlacementCB = (boardSpace: BoardSpace) => {
    const spaceID = boardSpace.getID();
    const token = this.createElement('div', 'influenceToken', 'player2Token');
    const spaceElement = document.getElementById(spaceID);
    spaceElement?.appendChild(token);
  };

  bindGetAvailCardSpaces(availCardSpacesCB: () => BoardSpace[]) {
    this.getAvailCardSpaces = availCardSpacesCB;
  }

  bindGetAvailTokenSpaces(availTokenSpacesCB: () => BoardSpace[]) {
    this.getAvailTokenSpaces = availTokenSpacesCB;
  }

  bindSendCardPlayToModel(
    sendCardPlayToModelCB: (cardID: string, spaceID: string) => boolean
  ) {
    this.sendCardPlayToModel = sendCardPlayToModelCB;
  }

  bindSendTokenPlayToModel(
    sendTokenPlaytoModelCB: (spaceID: string) => boolean
  ) {
    this.sendTokenPlayToModel = sendTokenPlaytoModelCB;
  }

  bindUndoPlayCard(undoPlayCardCB: (spaceID: string) => void) {
    this.undoPlayCard = undoPlayCardCB;
  }

  bindUndoPlaceToken(undoPlaceTokenCB: (spaceID: string) => void) {
    this.undoPlaceToken = undoPlaceTokenCB;
  }

  bindComputerTakeTurn(computerTurnCB: () => void) {
    this.computerTakeTurn = computerTurnCB;
  }

  bindGetCardDrawFromModel(drawCardCB: () => void) {
    this.getCardDrawFromModel = drawCardCB;
  }

  bindGetP1AvailableTokens(availTokensCB: () => number) {
    this.getP1AvailableTokensNumber = availTokensCB;
  }

  bindGetP2AvailableTokens(availTokensCB: () => number) {
    this.getP2AvailableTokensNumber = availTokensCB;
  }

  bindGetPlayer1Score(getPlayer1ScoreCB: () => void) {
    this.getPlayer1Score = getPlayer1ScoreCB;
  }

  bindGetPlayer2Score(getPlayer2ScoreCB: () => void) {
    this.getPlayer2Score = getPlayer2ScoreCB;
  }
}