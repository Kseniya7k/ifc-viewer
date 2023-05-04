import {Component, Input} from '@angular/core';

@Component({
  selector: 'app-list-tree',
  templateUrl: './list-tree.component.html',
  styleUrls: ['./list-tree.component.scss']
})
export class ListTreeComponent {

  @Input() tree: any;

}
