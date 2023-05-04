import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { BoardForIfcComponent } from './board-for-ifc/board-for-ifc.component';
import { TreeNodeComponent } from './tree-node/tree-node.component';
import { ItemTreeComponent } from './item-tree/item-tree.component';

@NgModule({
  declarations: [
    AppComponent,
    BoardForIfcComponent,
    TreeNodeComponent,
    ItemTreeComponent
  ],
  imports: [
    BrowserModule,
    AppRoutingModule
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
