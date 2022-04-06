import { Component, ViewChild, ViewEncapsulation, ElementRef, OnInit, OnDestroy, AfterViewInit } from '@angular/core';

import { Subscription, timer, Subject} from 'rxjs'; // , timer, Subject
import { takeUntil, filter, map } from 'rxjs/operators';

// https://rembound.com/articles/bubble-shooter-game-tutorial-with-html5-and-javascript#demo
// https://rembound.com/articles/how-to-make-a-match3-game-with-html5-canvas
@Component({
  selector: 'app-game',
  templateUrl: 'game.page.html',
  styleUrls: ['game.page.scss'],
  encapsulation: ViewEncapsulation.None
})
export class GameComponent implements OnInit, OnDestroy, AfterViewInit {
    @ViewChild('gameCanvas', {static: true}) gameCanvas: ElementRef<HTMLCanvasElement> = {} as ElementRef;

    // Get the canvas and context
    // private canvas = document.getElementById('viewport');
    private canvas: any;
    private context: any;

    // Timing and frames per second
    private lastframe = 0;
    private fpstime = 0;
    private framecount = 0;
    private fps = 0;

    // Mouse dragging
    private drag = false;

    // Level object
    private level: any = {
        x: 250,         // X position
        y: 113,         // Y position
        columns: 8,     // Number of tile columns
        rows: 8,        // Number of tile rows
        tilewidth: 40,  // Visual width of a tile
        tileheight: 40, // Visual height of a tile
        tiles: [[]],      // The two-dimensional tile array
        selectedtile: { selected: false, column: 0, row: 0 }
    };

    // All of the different tile colors in RGB
    private tilecolors = [[255, 128, 128],
                      [128, 255, 128],
                      [128, 128, 255],
                      [255, 255, 128],
                      [255, 128, 255],
                      [128, 255, 255],
                      [255, 255, 255]];

    // Clusters and moves that were found
    private clusters: any = [];  // { column, row, length, horizontal }
    private moves: any = [];     // { column1, row1, column2, row2 }

    // Current move
    private currentmove = { column1: 0, row1: 0, column2: 0, row2: 0 };

    // Game states
    private gamestates = { init: 0, ready: 1, resolve: 2 };
    private gamestate = this.gamestates.init;

    // Score
    private score = 0;

    // Animation variables
    private animationstate = 0;
    private animationtime = 0;
    private animationtimetotal = 0.3;

    // Show available moves
    private showmoves = false;

    // The AI bot
    private aibot = false;

    // Game Over
    private gameover = false;

    // Gui buttons
    private buttons = [ { x: 30, y: 240, width: 150, height: 50, text: 'New Game'},
                    { x: 30, y: 300, width: 150, height: 50, text: 'Show Moves'},
                    { x: 30, y: 360, width: 150, height: 50, text: 'Enable AI Bot'}];


    constructor(
        // private route: ActivatedRoute,
        // private eventSvc: EventService,
        // private configSvc: ConfigService,
        // // private dialogs: Dialog,
        // private spinner: NgxSpinnerService,
        // private admobService: AdMobService,
        // public dialog: MatDialog,
    ) {

    }

    ngOnInit() {
    }

    ngAfterViewInit() {
        this.init();
    }

    ngOnDestroy() {
        // this.updateNonoGram();
        // this.ngUnsubscribe.next(null);
        // this.ngUnsubscribe.complete();
        // if (this.timerSubscription) {
        //     this.timerSubscription.unsubscribe();
        // }
    }

    init() {
        // Get the grid position
        // Add mouse events
        this.canvas = this.gameCanvas.nativeElement;
        this.context = this.canvas.getContext('2d');

        // Initialize the two-dimensional tile array
        for (let i=0; i< this.level.columns; i++) {
            this.level.tiles[i] = [];
            for (let j = 0; j < this.level.rows; j++) {
                // Define a tile type and a shift parameter for animation
                this.level.tiles[i][j] = { type: 0, shift:0 }
            }
        }

        // New game
        this.newGame();

        // Enter main loop
        this.main(0);

    }
    // Main loop
    private main(tframe: number) {
        // Request animation frames
        window.requestAnimationFrame(this.main.bind(this));
        // window.requestAnimationFrame(() => this.main);
        // Update and render the game
        this.update(tframe);
        this.render();
    }

    // Update the game state
    private update(tframe: number) {
        let dt = (tframe - this.lastframe) / 1000;
        this.lastframe = tframe;

        // Update the fps counter
        this.updateFps(dt);

        if (this.gamestate == this.gamestates.ready) {
            // Game is ready for player input

            // Check for game over
            if (this.moves.length <= 0) {
                this.gameover = true;
            }

            // Let the AI bot make a move, if enabled
            if (this.aibot) {
                this.animationtime += dt;
                if (this.animationtime > this.animationtimetotal) {
                    // Check if there are moves available
                    this.findMoves();

                    if (this.moves.length > 0) {
                         // Get a random valid move
                        const move: any = this.moves[Math.floor(Math.random() * this.moves.length)];

                        // Simulate a player using the mouse to swap two tiles
                        this.mouseSwap(move.column1, move.row1, move.column2, move.row2);
                    } else {
                         // No moves left, Game Over. We could start a new game.
                         // newGame();
                    }
                    this.animationtime = 0;
                 }
             }
         } else if (this.gamestate == this.gamestates.resolve) {
            // Game is busy resolving and animating clusters
            this.animationtime += dt;

            if (this.animationstate == 0) {
                // Clusters need to be found and removed
                if (this.animationtime > this.animationtimetotal) {
                    // Find clusters
                    this.findClusters();

                    if (this.clusters.length > 0) {
                        // Add points to the score
                        for (let i = 0; i < this.clusters.length; i++) {
                            // Add extra points for longer clusters
                            this.score += 100 * (this.clusters[i].length - 2);;
                        }

                        // Clusters found, remove them
                        this.removeClusters();

                        // Tiles need to be shifted
                        this.animationstate = 1;
                    } else {
                        // No clusters found, animation complete
                        this.gamestate = this.gamestates.ready;
                    }
                    this.animationtime = 0;
                }
            } else if (this.animationstate == 1) {
                // Tiles need to be shifted
                if (this.animationtime > this.animationtimetotal) {
                    // Shift tiles
                    this.shiftTiles();

                    // New clusters need to be found
                    this.animationstate = 0;
                    this.animationtime = 0;

                    // Check if there are new clusters
                    this.findClusters();
                    if (this.clusters.length <= 0) {
                        // Animation complete
                        this.gamestate = this.gamestates.ready;
                    }
                }
            } else if (this.animationstate == 2) {
                // Swapping tiles animation
                if (this.animationtime > this.animationtimetotal) {
                    // Swap the tiles
                    this.swap(this.currentmove.column1, this.currentmove.row1, this.currentmove.column2, this.currentmove.row2);

                    // Check if the swap made a cluster
                    this.findClusters();
                    if (this.clusters.length > 0) {
                        // Valid swap, found one or more clusters
                        // Prepare animation states
                        this.animationstate = 0;
                        this.animationtime = 0;
                        this.gamestate = this.gamestates.resolve;
                    } else {
                        // Invalid swap, Rewind swapping animation
                        this.animationstate = 3;
                        this.animationtime = 0;
                    }

                    // Update moves and clusters
                    this.findMoves();
                    this.findClusters();
                }
            } else if (this.animationstate == 3) {
                // Rewind swapping animation
                if (this.animationtime > this.animationtimetotal) {
                    // Invalid swap, swap back
                    this.swap(this.currentmove.column1, this.currentmove.row1, this.currentmove.column2, this.currentmove.row2);

                    // Animation complete
                    this.gamestate = this.gamestates.ready;
                 }
             }

            // Update moves and clusters
            this.findMoves();
            this.findClusters();
         }
     }

     private updateFps(dt: number) {
        if (this.fpstime > 0.25) {
            // Calculate fps
            this.fps = Math.round(this.framecount / this.fpstime);

            // Reset time and framecount
            this.fpstime = 0;
            this.framecount = 0;
        }

        // Increase time and framecount
        this.fpstime += dt;
        this.framecount++;
    }

    // Draw text that is centered
    private drawCenterText(text: string, x: number, y: number, width: number) {
        let textdim = this.context.measureText(text);
        this.context.fillText(text, x + (width-textdim.width) / 2, y);
    }

     // Render the game
    private render() {
        // Draw the frame
        this.drawFrame();

        // Draw score
        this.context.fillStyle = '#000000';
        this.context.font = '24px Verdana';
        this.drawCenterText('Score:', 30, this.level.y + 40, 150);
        this.drawCenterText(this.score.toString(), 30, this.level.y + 70, 150);

        // Draw buttons
        this.drawButtons();

        // Draw level background
        const levelwidth = this.level.columns * this.level.tilewidth;
        const levelheight = this.level.rows * this.level.tileheight;
        this.context.fillStyle = '#000000';
        this.context.fillRect(this.level.x - 4, this.level.y - 4, levelwidth + 8, levelheight + 8);

        // Render tiles
        this.renderTiles();

        // Render clusters
        this.renderClusters();

        // Render moves, when there are no clusters
        if (this.showmoves && this.clusters.length <= 0 && this.gamestate == this.gamestates.ready) {
            this.renderMoves();
        }

        // Game Over overlay
        if (this.gameover) {
            this.context.fillStyle = 'rgba(0, 0, 0, 0.8)';
            this.context.fillRect(this.level.x, this.level.y, levelwidth, levelheight);

            this.context.fillStyle = '#ffffff';
            this.context.font = '24px Verdana';
            this.drawCenterText('Game Over!', this.level.x, this.level.y + levelheight / 2 + 10, levelwidth);
        }
    }

    // Draw a frame with a border
    private drawFrame() {
        // Draw background and a border
        this.context.fillStyle = '#d0d0d0';
        this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.fillStyle = '#e8eaec';
        this.context.fillRect(1, 1, this.canvas.width-2, this.canvas.height-2);

        // Draw header
        this.context.fillStyle = '#303030';
        this.context.fillRect(0, 0, this.canvas.width, 65);

        // Draw title
        this.context.fillStyle = '#ffffff';
        this.context.font = '24px Verdana';
        this.context.fillText('Match3 Example - Rembound.com', 10, 30);

        // Display fps
        this.context.fillStyle = '#ffffff';
        this.context.font = '12px Verdana';
        this.context.fillText('Fps: ' + this.fps, 13, 50);
    }

    // Draw buttons
    private drawButtons() {
        for (let i = 0; i < this.buttons.length; i++) {
            // Draw button shape
            this.context.fillStyle = '#000000';
            this.context.fillRect(this.buttons[i].x, this.buttons[i].y, this.buttons[i].width, this.buttons[i].height);

            // Draw button text
            this.context.fillStyle = '#ffffff';
            this.context.font = '18px Verdana';
            let textdim = this.context.measureText(this.buttons[i].text);
            this.context.fillText(this.buttons[i].text, this.buttons[i].x + (this.buttons[i].width-textdim.width)/2, this.buttons[i].y+30);
        }
    }

    // Render tiles
    private renderTiles() {
        for (let i = 0; i < this.level.columns; i++) {
            for (let j = 0; j < this.level.rows; j++) {
                // Get the shift of the tile for animation
                let shift = this.level.tiles[i][j].shift;

                // Calculate the tile coordinates
                let coord = this.getTileCoordinate(i, j, 0, (this.animationtime / this.animationtimetotal) * shift);

                // Check if there is a tile present
                if (this.level.tiles[i][j].type >= 0) {
                    // Get the color of the tile
                    let col = this.tilecolors[this.level.tiles[i][j].type];

                    // Draw the tile using the color
                    this.drawTile(coord.tilex, coord.tiley, col[0], col[1], col[2]);
                }

                // Draw the selected tile
                if (this.level.selectedtile.selected) {
                    if (this.level.selectedtile.column == i && this.level.selectedtile.row == j) {
                        // Draw a red tile
                        this.drawTile(coord.tilex, coord.tiley, 255, 0, 0);
                    }
                }
            }
        }

        // Render the swap animation
        if (this.gamestate === this.gamestates.resolve && (this.animationstate === 2 || this.animationstate === 3)) {
            // Calculate the x and y shift
            let shiftx = this.currentmove.column2 - this.currentmove.column1;
            let shifty = this.currentmove.row2 - this.currentmove.row1;

            // First tile
            let coord1 = this.getTileCoordinate(this.currentmove.column1, this.currentmove.row1, 0, 0);
            let coord1shift = this.getTileCoordinate(this.currentmove.column1, this.currentmove.row1, (this.animationtime / this.animationtimetotal) * shiftx, (this.animationtime / this.animationtimetotal) * shifty);
            let col1 = this.tilecolors[this.level.tiles[this.currentmove.column1][this.currentmove.row1].type];

            // Second tile
            let coord2 = this.getTileCoordinate(this.currentmove.column2, this.currentmove.row2, 0, 0);
            let coord2shift = this.getTileCoordinate(this.currentmove.column2, this.currentmove.row2, (this.animationtime / this.animationtimetotal) * -shiftx, (this.animationtime / this.animationtimetotal) * -shifty);
            let col2 = this.tilecolors[this.level.tiles[this.currentmove.column2][this.currentmove.row2].type];

            // Draw a black background
            this.drawTile(coord1.tilex, coord1.tiley, 0, 0, 0);
            this.drawTile(coord2.tilex, coord2.tiley, 0, 0, 0);

            // Change the order, depending on the animation state
            if (this.animationstate == 2) {
                // Draw the tiles
                this.drawTile(coord1shift.tilex, coord1shift.tiley, col1[0], col1[1], col1[2]);
                this.drawTile(coord2shift.tilex, coord2shift.tiley, col2[0], col2[1], col2[2]);
            } else {
                // Draw the tiles
                this.drawTile(coord2shift.tilex, coord2shift.tiley, col2[0], col2[1], col2[2]);
                this.drawTile(coord1shift.tilex, coord1shift.tiley, col1[0], col1[1], col1[2]);
            }
        }
    }

    // Get the tile coordinate
    private getTileCoordinate(column: number, row: number, columnoffset: number, rowoffset: number) {
        let tilex = this.level.x + (column + columnoffset) * this.level.tilewidth;
        let tiley = this.level.y + (row + rowoffset) * this.level.tileheight;
        return { tilex: tilex, tiley: tiley};
    }

    // Draw a tile with a color
    private drawTile(x: number, y: number, r: number, g: number, b: number) {
        this.context.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
        this.context.fillRect(x + 2, y + 2, this.level.tilewidth - 4, this.level.tileheight - 4);
    }

    // Render clusters
    private renderClusters() {
        for (let i=0; i < this.clusters.length; i++) {
            // Calculate the tile coordinates
            let coord = this.getTileCoordinate(this.clusters[i].column, this.clusters[i].row, 0, 0);

            if (this.clusters[i].horizontal) {
                // Draw a horizontal line
                this.context.fillStyle = '#00ff00';
                this.context.fillRect(coord.tilex + this.level.tilewidth/2, coord.tiley + this.level.tileheight/2 - 4, (this.clusters[i].length - 1) * this.level.tilewidth, 8);
            } else {
                // Draw a vertical line
                this.context.fillStyle = '#0000ff';
                this.context.fillRect(coord.tilex + this.level.tilewidth/2 - 4, coord.tiley + this.level.tileheight/2, 8, (this.clusters[i].length - 1) * this.level.tileheight);
            }
        }
    }

    // Render moves
    private renderMoves() {
        for (let i = 0; i < this.moves.length; i++) {
            // Calculate coordinates of tile 1 and 2
            let coord1 = this.getTileCoordinate(this.moves[i].column1, this.moves[i].row1, 0, 0);
            let coord2 = this.getTileCoordinate(this.moves[i].column2, this.moves[i].row2, 0, 0);

            // Draw a line from tile 1 to tile 2
            this.context.strokeStyle = '#ff0000';
            this.context.beginPath();
            this.context.moveTo(coord1.tilex + this.level.tilewidth/2, coord1.tiley + this.level.tileheight/2);
            this.context.lineTo(coord2.tilex + this.level.tilewidth/2, coord2.tiley + this.level.tileheight/2);
            this.context.stroke();
         }
     }

    // Start a new game
    private newGame() {
        // Reset score
        this.score = 0;

        // Set the gamestate to ready
        this.gamestate = this.gamestates.ready;

        // Reset game over
        this.gameover = false;

        // Create the level
        this.createLevel();

        // Find initial clusters and moves
        this.findMoves();
        this.findClusters();
     }

    // Create a random level
    private createLevel() {
        let done = false;

        // Keep generating levels until it is correct
        while (!done) {

            // Create a level with random tiles
            for (let i = 0; i < this.level.columns; i++) {
                for (let j = 0; j < this.level.rows; j++) {
                    this.level.tiles[i][j].type = this.getRandomTile();
                }
            }

            // Resolve the clusters
            this.resolveClusters();

            // Check if there are valid moves
            this.findMoves();

            // Done when there is a valid move
            if (this.moves.length > 0) {
                done = true;
            }
        }
    }

    // Get a random tile
    private getRandomTile() {
        return Math.floor(Math.random() * this.tilecolors.length);
    }

    // Remove clusters and insert tiles
    private resolveClusters() {
        // Check for clusters
        this.findClusters();

        // While there are clusters left
        while (this.clusters.length > 0) {

            // Remove clusters
            this.removeClusters();

            // Shift tiles
            this.shiftTiles();

            // Check if there are clusters left
            this.findClusters();
        }
    }

    // Find clusters in the level
    private findClusters() {
        // Reset clusters
        this.clusters = []

        // Find horizontal clusters
        for (let j = 0;  j < this.level.rows; j++) {
            // Start with a single tile, cluster of 1
            let matchlength = 1;
            for (let i=0; i < this.level.columns; i++) {
                let checkcluster = false;

                if (i == this.level.columns-1) {
                    // Last tile
                    checkcluster = true;
                } else {
                    // Check the type of the next tile
                    if (this.level.tiles[i][j].type == this.level.tiles[i+1][j].type &&
                        this.level.tiles[i][j].type != -1) {
                        // Same type as the previous tile, increase matchlength
                        matchlength += 1;
                    } else {
                        // Different type
                        checkcluster = true;
                    }
                }

                // Check if there was a cluster
                if (checkcluster) {
                    if (matchlength >= 3) {
                        // Found a horizontal cluster
                        this.clusters.push({ column: i+1-matchlength, row:j,
                                        length: matchlength, horizontal: true });
                    }

                    matchlength = 1;
                }
            }
        }

        // Find vertical clusters
        for (let i = 0; i < this.level.columns; i++) {
            // Start with a single tile, cluster of 1
            let matchlength = 1;
            for (let j = 0; j < this.level.rows; j++) {
                let checkcluster = false;

                if (j === this.level.rows-1) {
                    // Last tile
                    checkcluster = true;
                } else {
                    // Check the type of the next tile
                    if (this.level.tiles[i][j].type == this.level.tiles[i][j+1].type &&
                        this.level.tiles[i][j].type != -1) {
                        // Same type as the previous tile, increase matchlength
                        matchlength += 1;
                    } else {
                        // Different type
                        checkcluster = true;
                    }
                }

                // Check if there was a cluster
                if (checkcluster) {
                    if (matchlength >= 3) {
                        // Found a vertical cluster
                        this.clusters.push({
                            column: i,
                            row: j + 1 - matchlength,
                            length: matchlength,
                            horizontal: false
                        });
                    }

                    matchlength = 1;
                }
            }
        }
    }

    // Find available moves
    private findMoves() {
        // Reset moves
        this.moves = []

         // Check horizontal swaps
        for (let j = 0; j < this.level.rows; j++) {
            for (let i = 0; i< this.level.columns-1; i++) {
                // Swap, find clusters and swap back
                this.swap(i, j, i+1, j);
                this.findClusters();
                this.swap(i, j, i+1, j);

                // Check if the swap made a cluster
                if (this.clusters.length > 0) {
                    // Found a move
                    this.moves.push({column1: i, row1: j, column2: i+1, row2: j});
                }
            }
        }

        // Check vertical swaps
        for (let i = 0;  i < this.level.columns; i++) {
            for (let j=0; j < this.level.rows-1; j++) {
                // Swap, find clusters and swap back
                this.swap(i, j, i, j+1);
                this.findClusters();
                this.swap(i, j, i, j+1);

                // Check if the swap made a cluster
                if (this.clusters.length > 0) {
                    // Found a move
                    this.moves.push({column1: i, row1: j, column2: i, row2: j+1});
                }
            }
        }

        // Reset clusters
        this.clusters = []
    }

    // Loop over the cluster tiles and execute a function
    private loopClusters(func: (i: number, column: number, row: number, cluster: any) => void) {
        for (let i = 0; i < this.clusters.length; i++) {
            //  { column, row, length, horizontal }
            const cluster: any = this.clusters[i];
            let coffset = 0;
            let roffset = 0;
            for (let j = 0; j < cluster.length; j++) {
                func(i, cluster.column + coffset, cluster.row + roffset, cluster);

                if (cluster.horizontal) {
                    coffset++;
                } else {
                    roffset++;
                }
            }
        }
    }

    // Remove the clusters
    private removeClusters() {
        // Change the type of the tiles to -1, indicating a removed tile
        this.loopClusters((index, column, row, cluster) => {
            this.level.tiles[column][row].type = -1;
        });

        // Calculate how much a tile should be shifted downwards
        for (let i = 0; i < this.level.columns; i++) {
            let shift = 0;
            for (let j = this.level.rows-1; j >= 0; j--) {
                // Loop from bottom to top
                if (this.level.tiles[i][j].type == -1) {
                    // Tile is removed, increase shift
                    shift++;
                    this.level.tiles[i][j].shift = 0;
                } else {
                    // Set the shift
                    this.level.tiles[i][j].shift = shift;
                }
            }
        }
    }

    // Shift tiles and insert new tiles
    private shiftTiles() {
        // Shift tiles
        for (let i = 0; i < this.level.columns; i++) {
             for (let j = this.level.rows-1; j >= 0; j--) {
                // Loop from bottom to top
                if (this.level.tiles[i][j].type == -1) {
                    // Insert new random tile
                    this.level.tiles[i][j].type = this.getRandomTile();
                } else {
                    // Swap tile to shift it
                    let shift = this.level.tiles[i][j].shift;
                    if (shift > 0) {
                        this.swap(i, j, i, j+shift)
                    }
                }

                // Reset shift
                this.level.tiles[i][j].shift = 0;
            }
        }
    }

    /*
     * Get the tile under the mouse
     *@param Object pos : {x, y}
     */
    private getMouseTile(pos: any) {
        // Calculate the index of the tile
        let tx = Math.floor((pos.x - this.level.x) / this.level.tilewidth);
        let ty = Math.floor((pos.y - this.level.y) / this.level.tileheight);

        // Check if the tile is valid
        if (tx >= 0 && tx < this.level.columns && ty >= 0 && ty < this.level.rows) {
            // Tile is valid
            return {
                valid: true,
                x: tx,
                y: ty
            };
        }

        // No valid tile
        return {
            valid: false,
            x: 0,
            y: 0
        };
    }

    // Check if two tiles can be swapped
    private canSwap(x1: number, y1: number, x2: number, y2: number) {
        // Check if the tile is a direct neighbor of the selected tile
        if ((Math.abs(x1 - x2) == 1 && y1 == y2) ||
            (Math.abs(y1 - y2) == 1 && x1 == x2)) {
            return true;
        }

        return false;
    }

    // Swap two tiles in the level
    private swap(x1: number, y1: number, x2: number, y2: number) {
        const typeswap = this.level.tiles[x1][y1].type;
        this.level.tiles[x1][y1].type = this.level.tiles[x2][y2].type;
        this.level.tiles[x2][y2].type = typeswap;
    }

    // Swap two tiles as a player action
    private mouseSwap(c1: number, r1: number, c2: number, r2: number) {
        // Save the current move
        this.currentmove = {column1: c1, row1: r1, column2: c2, row2: r2};

        // Deselect
        this.level.selectedtile.selected = false;

        // Start animation
        this.animationstate = 2;
        this.animationtime = 0;
        this.gamestate = this.gamestates.resolve;
     }

    // On mouse movement
    public onMouseMove(e: any) {
        // Get the mouse position
        let pos = this.getMousePos(this.canvas, e);

        // Check if we are dragging with a tile selected
        if (this.drag && this.level.selectedtile.selected) {
            // Get the tile under the mouse
            const mt = this.getMouseTile(pos);
            if (mt.valid) {
                // Valid tile

                // Check if the tiles can be swapped
                if (this.canSwap(mt.x, mt.y, this.level.selectedtile.column, this.level.selectedtile.row)){
                    // Swap the tiles
                    this.mouseSwap(mt.x, mt.y, this.level.selectedtile.column, this.level.selectedtile.row);
                }
            }
        }
    }

    // On mouse button click
    public onMouseDown(e: any) {
        // Get the mouse position
        const pos = this.getMousePos(this.canvas, e);
        // Start dragging
        if (!this.drag) {
            // Get the tile under the mouse
            const mt = this.getMouseTile(pos);
            if (mt.valid) {
                // Valid tile
                let swapped = false;
                if (this.level.selectedtile.selected) {
                    if (mt.x === this.level.selectedtile.column && mt.y === this.level.selectedtile.row) {
                        // Same tile selected, deselect
                        this.level.selectedtile.selected = false;
                        this.drag = true;
                        return;
                    } else if (this.canSwap(mt.x, mt.y, this.level.selectedtile.column, this.level.selectedtile.row)){
                        // Tiles can be swapped, swap the tiles
                        this.mouseSwap(mt.x, mt.y, this.level.selectedtile.column, this.level.selectedtile.row);
                        swapped = true;
                    }
                }

                if (!swapped) {
                    // Set the new selected tile
                    this.level.selectedtile.column = mt.x;
                    this.level.selectedtile.row = mt.y;
                    this.level.selectedtile.selected = true;
                }
            } else {
                // Invalid tile
                this.level.selectedtile.selected = false;
            }

            // Start dragging
            this.drag = true;
        }

        // Check if a button was clicked
        for (let i = 0; i < this.buttons.length; i++) {
             if (pos.x >= this.buttons[i].x && pos.x < this.buttons[i].x + this.buttons[i].width &&
                pos.y >= this.buttons[i].y && pos.y < this.buttons[i].y + this.buttons[i].height) {

                // Button i was clicked
                if (i == 0) {
                     // New Game

                    this.newGame();
                } else if (i == 1) {
                    // Show Moves
                    this.showmoves = !this.showmoves;
                    this.buttons[i].text = (this.showmoves ? 'Hide' : 'Show') + ' Moves';
                } else if (i == 2) {
                    // AI Bot
                    this.aibot = !this.aibot;
                    this.buttons[i].text = (this.aibot ? 'Disable' : 'Enable') + ' AI Bot';
                }
            }
        }
    }

    public onMouseUp() {
        // Reset dragging
        this.drag = false;
    }

    public onMouseOut() {
        // Reset dragging
        this.drag = false;
    }

     // Get the mouse position
    private getMousePos(canvas: any, e: any) {
        let rect = canvas.getBoundingClientRect();
        return {
            x: Math.round((e.clientX - rect.left)/(rect.right - rect.left)*canvas.width),
            y: Math.round((e.clientY - rect.top)/(rect.bottom - rect.top)*canvas.height)
        };
    }

}
